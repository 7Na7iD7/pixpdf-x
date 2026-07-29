use crate::utils::errors::PDFError;
use tauri::{command, AppHandle};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// PDF encryption/decryption is delegated to the `qpdf` command-line tool
/// because there is no mature pure-Rust crate that implements PDF's
/// standard security handler (RC4/AES + owner/user password + permission
/// bits) end to end. qpdf is the same engine many PDF tools rely on.
///
/// SETUP REQUIRED: install qpdf and make sure it's on PATH:
///   - Windows: https://qpdf.sourceforge.io/ (installer) or `winget install QPDF.QPDF`
///   - macOS:   `brew install qpdf`
///   - Linux:   `apt install qpdf` / `dnf install qpdf` / etc.
///
/// Also required — Tauri v2's shell plugin is permission-gated. Add this to
/// `src-tauri/capabilities/default.json` (create the capabilities section if
/// you don't have one) so the app is allowed to spawn qpdf:
///
/// {
///   "permissions": [
///     { "identifier": "shell:allow-execute" }
///   ]
/// }
///
/// and register an allowed command in your shell plugin scope, e.g. in
/// `tauri.conf.json` -> "plugins" -> "shell" or via a capability's `scope`
/// entry naming `"qpdf"` as an allowed binary. Consult the Tauri v2 shell
/// plugin docs for the exact scope syntax for your Tauri version, since this
/// changed between 2.0 betas — if `encrypt_pdf`/`decrypt_pdf` fail with a
/// permission/scope error rather than "qpdf not found", that's the fix needed.

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
        // qpdf returns a specific, recognizable message for a bad password —
        // surface that distinctly so the UI can say "wrong password" rather
        // than a generic failure.
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
