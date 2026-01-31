"""
Main entry point for the Scheduled Message System.

This module starts both the FastAPI server and Telegram bot concurrently.
Run with: python main.py
"""
import multiprocessing
import signal
import sys
import time
import logging
import uvicorn

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


def run_api_server():
    """Run the FastAPI server on port 8080"""
    from api import app
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8080,
        log_level="warning"
    )


def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    _ = (sig, frame)  # Unused but required by signal.signal API
    logger.info("\n\nReceived interrupt signal. Shutting down services...")
    sys.exit(0)


def main():
    """Main function to start all services"""
    # Set up signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)

    # Create processes for both services
    api_process = multiprocessing.Process(target=run_api_server, name="API-Server")
    
    try:
        logger.info("="*60)
        logger.info("Starting Scheduled Message System")
        logger.info("="*60)

        logger.info("Starting FastAPI server on port 8080...")
        api_process.start()
        time.sleep(1)  # Give API server a moment to start

        # Monitor processes and restart if they crash
        while True:
            if not api_process.is_alive():
                logger.warning("API server process died. Restarting...")
                api_process = multiprocessing.Process(target=run_api_server, name="API-Server")
                api_process.start()
            
            time.sleep(5)  # Check every 5 seconds

    except KeyboardInterrupt:
        logger.info("\n\nShutting down services...")
    except Exception as e:
        logger.error(f"\n\nError occurred: {e}")
    finally:
        # Ensure both processes are terminated
        logger.info("Stopping API server...")
        if api_process.is_alive():
            api_process.terminate()
            api_process.join(timeout=5)
            if api_process.is_alive():
                api_process.kill()


        logger.info("All services stopped.")
        logger.info("="*60)


if __name__ == "__main__":
    main()
