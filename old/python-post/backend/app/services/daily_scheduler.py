"""
Daily Bitcoin Data Update Scheduler
Automatically updates Bitcoin data daily when backend is running
"""

import asyncio
import schedule
import time
import logging
from datetime import datetime
from threading import Thread

from app.services.bitcoin_update_service import bitcoin_update_service

logger = logging.getLogger(__name__)

class DailyUpdateScheduler:
    """Scheduler for daily Bitcoin data updates"""
    
    def __init__(self):
        self.running = False
        self.thread = None
    
    def start_scheduler(self):
        """Start the daily update scheduler"""
        if self.running:
            logger.warning("Scheduler already running")
            return
        
        logger.info("Starting daily Bitcoin data update scheduler")
        
        # Schedule daily update at 6:00 AM
        schedule.every().day.at("06:00").do(self._run_daily_update)
        
        # Also schedule hourly data quality checks
        schedule.every().hour.do(self._run_data_quality_check)
        
        self.running = True
        self.thread = Thread(target=self._scheduler_loop, daemon=True)
        self.thread.start()
        
        logger.info("✅ Daily update scheduler started")
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        if not self.running:
            return
            
        logger.info("Stopping daily update scheduler")
        self.running = False
        schedule.clear()
        
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        
        logger.info("✅ Daily update scheduler stopped")
    
    def _scheduler_loop(self):
        """Main scheduler loop"""
        while self.running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except Exception as e:
                logger.error(f"Scheduler error: {str(e)}")
                time.sleep(300)  # Wait 5 minutes on error
    
    def _run_daily_update(self):
        """Run the daily Bitcoin data update"""
        logger.info("🔄 Starting scheduled daily Bitcoin data update")
        
        try:
            # Run the async update in a new event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(
                bitcoin_update_service.update_daily_data(days_to_fetch=2)  # Update last 2 days for safety
            )
            
            loop.close()
            
            if result.get('success'):
                logger.info(f"✅ Daily update completed: {result['records_inserted']} inserted, {result['records_updated']} updated")
            else:
                logger.error(f"❌ Daily update failed: {result.get('errors', [])}")
                
        except Exception as e:
            logger.error(f"❌ Daily update exception: {str(e)}")
    
    def _run_data_quality_check(self):
        """Run hourly data quality checks"""
        try:
            # Check if we have recent data
            cached_data = bitcoin_update_service.get_cached_data(days=1)
            
            if not cached_data:
                logger.warning("⚠️ No recent Bitcoin data found, triggering update")
                self._run_daily_update()
            elif len(cached_data) < 24:  # Less than 24 hours of data
                logger.warning("⚠️ Insufficient recent data, triggering update")
                self._run_daily_update()
            else:
                logger.debug("✅ Data quality check passed")
                
        except Exception as e:
            logger.error(f"Data quality check error: {str(e)}")
    
    def manual_update(self, days: int = 1) -> dict:
        """Manually trigger an update"""
        logger.info(f"🔄 Manual Bitcoin data update requested for {days} days")
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(
                bitcoin_update_service.update_daily_data(days_to_fetch=days)
            )
            
            loop.close()
            return result
            
        except Exception as e:
            logger.error(f"Manual update failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


# Global scheduler instance
daily_scheduler = DailyUpdateScheduler()

# Auto-start scheduler when module is imported (if not already running)
def initialize_scheduler():
    """Initialize the scheduler if not already running"""
    if not daily_scheduler.running:
        try:
            daily_scheduler.start_scheduler()
        except Exception as e:
            logger.error(f"Failed to start scheduler: {str(e)}")

# Call initialize when module loads
initialize_scheduler()
