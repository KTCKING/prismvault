use std::path::{Path, PathBuf};
use std::fs;
use std::io::Read;

pub struct ThumbnailEngine {
    cache_dir: PathBuf,
    grid_size: u32,
    preview_size: u32,
}

impl ThumbnailEngine {
    pub fn new(cache_dir: &Path) -> Self {
        fs::create_dir_all(cache_dir).ok();
        ThumbnailEngine {
            cache_dir: cache_dir.to_path_buf(),
            grid_size: 512,
            preview_size: 2048,
        }
    }

    pub fn thumbnail_path(&self, content_hash: &str, size: u32) -> PathBuf {
        let prefix = &content_hash[..2.min(content_hash.len())];
        let dir = self.cache_dir.join(prefix);
        dir.join(format!("{}_{}.jpg", content_hash, size))
    }

    /// Generate a thumbnail — tries EXIF first, then full decode
    pub fn generate(&self, source_path: &Path, content_hash: &str) -> Result<PathBuf, String> {
        let thumb_path = self.thumbnail_path(content_hash, self.grid_size);
        
        if let Some(parent) = thumb_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        if thumb_path.exists() {
            return Ok(thumb_path);
        }

        // Try EXIF thumbnail first (near-instant for JPEGs)
        if self.try_exif_thumbnail(source_path, &thumb_path).is_ok() {
            return Ok(thumb_path);
        }

        self.generate_with_image_crate(source_path, &thumb_path)?;
        Ok(thumb_path)
    }

    /// Extract EXIF thumbnail from JPEG by parsing APP1 marker
    fn try_exif_thumbnail(&self, source: &Path, dest: &Path) -> Result<(), String> {
        let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if ext != "jpg" && ext != "jpeg" { return Err("Not JPEG".into()); }

        let data = fs::read(source).map_err(|e| e.to_string())?;
        if data.len() < 20 { return Err("Too small".into()); }

        // Find APP1 marker (0xFFE1) containing "Exif\0\0"
        let mut pos = 2; // skip SOI
        while pos < data.len() - 4 {
            if data[pos] != 0xFF { return Err("Bad marker".into()); }
            let marker = data[pos + 1];
            if marker == 0xDA || marker == 0xD9 { break; } // SOS or EOI
            
            let len = ((data[pos + 2] as usize) << 8) | (data[pos + 3] as usize);
            if marker == 0xE1 && pos + 10 < data.len() && &data[pos+4..pos+10] == b"Exif\0\0" {
                // Found EXIF APP1, parse TIFF header for thumbnail
                let tiff_start = pos + 10;
                if tiff_start + 8 > data.len() { return Err("TIFF too short".into()); }
                
                let little_endian = &data[tiff_start..tiff_start+2] == b"II";
                let read_u16 = |p: usize| -> u16 {
                    if little_endian { data[p] as u16 | ((data[p+1] as u16) << 8) }
                    else { ((data[p] as u16) << 8) | data[p+1] as u16 }
                };
                let read_u32 = |p: usize| -> u32 {
                    if little_endian {
                        data[p] as u32 | ((data[p+1] as u32) << 8) | ((data[p+2] as u32) << 16) | ((data[p+3] as u32) << 24)
                    } else {
                        ((data[p] as u32) << 24) | ((data[p+1] as u32) << 16) | ((data[p+2] as u32) << 8) | data[p+3] as u32
                    }
                };

                let ifd0_offset = read_u32(tiff_start + 4) as usize;
                if ifd0_offset == 0 || tiff_start + ifd0_offset + 2 > data.len() { return Err("IFD0 out of bounds".into()); }

                // Skip IFD0 to find IFD1
                let ifd0_pos = tiff_start + ifd0_offset;
                let num_entries = read_u16(ifd0_pos) as usize;
                let ifd1_pos = ifd0_pos + 2 + num_entries * 12 + 4; // +4 for next IFD offset
                if ifd1_pos + 2 > data.len() { return Err("IFD1 out of bounds".into()); }

                let ifd1_num = read_u16(ifd1_pos) as usize;
                let mut thumb_offset: Option<usize> = None;
                let mut thumb_len: Option<usize> = None;

                for i in 0..ifd1_num {
                    let entry_pos = ifd1_pos + 2 + i * 12;
                    if entry_pos + 12 > data.len() { break; }
                    let tag = read_u16(entry_pos);
                    let len = read_u32(entry_pos + 4) as usize;
                    let val = read_u32(entry_pos + 8) as usize;
                    // JPEGInterchangeFormat (0x0201) = offset, JPEGInterchangeFormatLength (0x0202) = length
                    if tag == 0x0201 { thumb_offset = Some(val); }
                    if tag == 0x0202 { thumb_len = Some(len.min(val)); }
                }

                if let (Some(off), Some(len)) = (thumb_offset, thumb_len) {
                    if off + len <= data.len() && len > 1024 {
                        let thumb_data = &data[off..off+len];
                        let jpeg_path = dest.with_extension("jpg");
                        if len < 100 * 1024 {
                            if let Ok(img) = image::load_from_memory(thumb_data) {
                                let resized = img.resize(self.grid_size, self.grid_size, image::imageops::FilterType::Triangle);
                                let mut jpeg = Vec::new();
                                let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 75);
                                enc.encode(&resized.to_rgb8(), resized.width(), resized.height(), image::ColorType::Rgb8.into())
                                    .map_err(|e| format!("JPEG encode: {}", e))?;
                                fs::write(&jpeg_path, &jpeg).map_err(|e| e.to_string())?;
                            }
                        } else {
                            fs::write(&jpeg_path, thumb_data).map_err(|e| e.to_string())?;
                        }
                        return Ok(());
                    }
                }
                break;
            }
            pos += 2 + len;
        }
        Err("No EXIF thumbnail".into())
    }

    /// Generate thumbnail using full image decode
    fn generate_with_image_crate(&self, source: &Path, dest: &Path) -> Result<(), String> {
        let img = image::ImageReader::open(source)
            .map_err(|e| format!("Failed to open: {}", e))?
            .decode()
            .map_err(|e| format!("Failed to decode: {}", e))?;

        let (w, h) = (img.width(), img.height());
        let target_size = self.grid_size;

        let thumb = if w > target_size || h > target_size {
            img.resize(target_size, target_size, image::imageops::FilterType::Triangle)
        } else {
            img
        };

        let mut jpeg_data = Vec::new();
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_data, 75);
        encoder
            .encode(&thumb.to_rgb8(), thumb.width(), thumb.height(), image::ColorType::Rgb8.into())
            .map_err(|e| format!("JPEG encode error: {}", e))?;

        let jpeg_path = dest.with_extension("jpg");
        fs::write(&jpeg_path, &jpeg_data).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Batch generate thumbnails in parallel using rayon
    pub fn generate_batch(&self, items: &[(PathBuf, String)]) -> Vec<(String, Result<PathBuf, String>)> {
        use rayon::prelude::*;
        items.par_iter().map(|(path, hash)| {
            (hash.clone(), self.generate(path, hash))
        }).collect()
    }

    pub fn cleanup_orphans(&self, active_hashes: &[String]) -> Result<u64, String> {
        let mut removed = 0u64;
        let active_set: std::collections::HashSet<&str> = active_hashes.iter().map(|s| s.as_str()).collect();

        for entry in walkdir::WalkDir::new(&self.cache_dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let name = entry.file_name().to_string_lossy();
            if let Some(hash_part) = name.split('_').next() {
                if !active_set.contains(hash_part) {
                    if fs::remove_file(entry.path()).is_ok() {
                        removed += 1;
                    }
                }
            }
        }
        Ok(removed)
    }

    pub fn cache_size(&self) -> u64 {
        walkdir::WalkDir::new(&self.cache_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .map(|e| e.metadata().map(|m| m.len()).unwrap_or(0))
            .sum()
    }
}