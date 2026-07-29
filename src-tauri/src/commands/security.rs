use crate::utils::errors::PDFError;
use tauri::{command, AppHandle};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;


#[command]
pub async fn encrypt_pdf(
    app: AppHandle,
    path: String,
    output_path: String,
    user_password: String,
    owner_password: Option<String>,
) -> Result<String, PDFError> {
    if user_password.is_empty() {
        return Err(PDFError::EncryptionError("User password cannot be empty".into()));
    }
    let owner_pw = owner_password.filter(|p| !p.is_empty()).unwrap_or_else(|| user_password.clone());

    let (mut rx, _child) = app
        .shell()
        .command("qpdf")
        .args([
            "--encrypt",
            &user_password,
            &owner_pw,
            "256",
            "--",
            &path,
            &output_path,
        ])
        .spawn()
        .map_err(|e| {
            PDFError::EncryptionError(format!(
                "Failed to start qpdf ({e}). Is it installed and on PATH? \
                 See security.rs doc comment for install instructions."
            ))
        })?;

    let mut stderr_output = String::new();
    let mut exit_code: Option<i32> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(bytes) => {
                stderr_output.push_str(&String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Error(err) => {
                stderr_output.push_str(&err);
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
            }
            _ => {}
        }
    }

    if exit_code != Some(0) {
        return Err(PDFError::EncryptionError(format!(
            "qpdf exited with code {:?}: {}",
            exit_code, stderr_output.trim()
        )));
    }

    Ok(output_path)
}

#[command]
pub async fn decrypt_pdf(
    app: AppHandle,
    path: String,
    output_path: String,
    password: String,
) -> Result<String, PDFError> {
    let password_arg = format!("--password={}", password);

    let (mut rx, _child) = app
        .shell()
        .command("qpdf")
        .args([&password_arg, "--decrypt", "--", &path, &output_path])
        .spawn()
        .map_err(|e| {
            PDFError::DecryptionError(format!(
                "Failed to start qpdf ({e}). Is it installed and on PATH? \
                 See security.rs doc comment for install instructions."
            ))
        })?;

    let mut stderr_output = String::new();
    let mut exit_code: Option<i32> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(bytes) => {
                stderr_output.push_str(&String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Error(err) => {
                stderr_output.push_str(&err);
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
            }
            _ => {}
        }
    }

    if exit_code != Some(0) {
  
        if stderr_output.to_lowercase().contains("invalid password") {
            return Err(PDFError::DecryptionError("Incorrect password".into()));
        }
        return Err(PDFError::DecryptionError(format!(
            "qpdf exited with code {:?}: {}",
            exit_code, stderr_output.trim()
        )));
    }

    Ok(output_path)
}
