// 👾 Daebug CLI entry point

use daebug::Server;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("👾Daebug v{} starting...", daebug::VERSION);
    
    let server = Server::new(".", 8342)?;
    server.run().await?;
    
    Ok(())
}
