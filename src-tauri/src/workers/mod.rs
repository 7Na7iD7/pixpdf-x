use tokio::sync::mpsc;

pub struct BackgroundWorker {
    sender: mpsc::Sender<WorkerTask>,
}

pub enum WorkerTask {
    Merge { paths: Vec<String>, output: String },
    Compress { path: String, output: String, quality: String },
}

impl BackgroundWorker {
    pub fn new() -> Self {
        let (sender, mut receiver) = mpsc::channel::<WorkerTask>(100);
        tokio::spawn(async move {
            while let Some(task) = receiver.recv().await {
                match task {
                    WorkerTask::Merge { paths, output } => {
                        log::info!("Merging {} files to {}", paths.len(), output);
                    }
                    WorkerTask::Compress { path, output, quality } => {
                        log::info!("Compressing {} to {} (quality: {})", path, output, quality);
                    }
                }
            }
        });
        Self { sender }
    }
    pub async fn submit(&self, task: WorkerTask) -> Result<(), String> {
        self.sender.send(task).await.map_err(|e| e.to_string())
    }
}
