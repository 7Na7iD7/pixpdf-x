use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize)]
pub enum PDFError {
    InvalidFile(String),
    InvalidPage(String),
    InvalidFormat(String),
    IoError(String),
    EncryptionError(String),
    DecryptionError(String),
    ProcessingError(String),
    NotImplemented(String),
}

impl fmt::Display for PDFError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PDFError::InvalidFile(s) => write!(f, "Invalid file: {}", s),
            PDFError::InvalidPage(s) => write!(f, "Invalid page: {}", s),
            PDFError::InvalidFormat(s) => write!(f, "Invalid format: {}", s),
            PDFError::IoError(s) => write!(f, "IO error: {}", s),
            PDFError::EncryptionError(s) => write!(f, "Encryption error: {}", s),
            PDFError::DecryptionError(s) => write!(f, "Decryption error: {}", s),
            PDFError::ProcessingError(s) => write!(f, "Processing error: {}", s),
            PDFError::NotImplemented(s) => write!(f, "Not implemented: {}", s),
        }
    }
}

impl std::error::Error for PDFError {}

impl From<lopdf::Error> for PDFError {
    fn from(err: lopdf::Error) -> Self {
        PDFError::ProcessingError(err.to_string())
    }
}

impl From<std::io::Error> for PDFError {
    fn from(err: std::io::Error) -> Self {
        PDFError::IoError(err.to_string())
    }
}
