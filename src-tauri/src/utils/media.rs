//! 媒体类型判定。
//!
//! 视频能入库、能播，但**不进缩略图队列**：解码器不认 mp4，硬排只会每轮开库
//! 都白试一遍。前端 `lib/thumbs.ts` 里有一份对应的 `isVideoPath`，两边清单
//! 要一致 —— 后端拦队列，前端拦请求。

/// 视频扩展名（小写，不带点）。
pub const VIDEO_EXTS: &[&str] = &[
    "mp4", "m4v", "webm", "mov", "mkv", "avi", "wmv", "flv", "ogv", "mpg", "mpeg", "ts", "3gp",
];

/// 按扩展名判断是不是视频。传进来的可以带点（`.mp4`），大小写不敏感。
pub fn is_video_ext(ext: &str) -> bool {
    let e = ext.trim_start_matches('.').to_ascii_lowercase();
    VIDEO_EXTS.contains(&e.as_str())
}

/// 按完整路径判断是不是视频。
pub fn is_video_path(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(is_video_ext)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn recognises_video_paths() {
        assert!(is_video_path(Path::new("a/b/clip.MP4")));
        assert!(is_video_path(Path::new("x.webm")));
        assert!(!is_video_path(Path::new("x.jpg")));
        assert!(!is_video_path(Path::new("x")));
    }

    #[test]
    fn tolerates_leading_dot_and_case() {
        assert!(is_video_ext(".Mov"));
        assert!(is_video_ext("MKV"));
        assert!(!is_video_ext("png"));
    }
}
