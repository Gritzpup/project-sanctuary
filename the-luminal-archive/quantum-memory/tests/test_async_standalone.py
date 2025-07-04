#!/usr/bin/env python3
"""
Standalone test of async processing capabilities for quantum memory system
"""

import asyncio
import json
import time
from pathlib import Path
from datetime import datetime
import aiofiles
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

# Try to use uvloop for better performance
try:
    import uvloop
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    print("✅ Using uvloop for enhanced async performance")
except ImportError:
    print("📌 Using standard asyncio event loop")

class AsyncProcessor:
    """Demonstrates async processing capabilities"""
    
    def __init__(self):
        self.event_queue = asyncio.Queue(maxsize=1000)
        self.result_queue = asyncio.Queue()
        self.thread_pool = ThreadPoolExecutor(max_workers=4)
        self.process_pool = ProcessPoolExecutor(max_workers=2)
        
        # Test data paths
        self.test_folder = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory")
        self.memories_folder = self.test_folder / "quantum_states" / "memories"
        
        # Stats
        self.stats = {
            'events_processed': 0,
            'batches_processed': 0,
            'processing_time': 0
        }
        
    async def process_batch(self, events):
        """Process a batch of events concurrently"""
        start_time = time.time()
        
        # Simulate concurrent processing
        tasks = []
        for event in events:
            tasks.append(self._process_single_event(event))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Update stats
        self.stats['events_processed'] += len(events)
        self.stats['batches_processed'] += 1
        self.stats['processing_time'] = time.time() - start_time
        
        return results
        
    async def _process_single_event(self, event):
        """Process a single event"""
        # Simulate some async work
        await asyncio.sleep(0.1)
        
        # Simulate CPU-bound work in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.thread_pool,
            self._cpu_bound_work,
            event
        )
        
        return {
            'event': event,
            'result': result,
            'timestamp': datetime.now().isoformat()
        }
        
    def _cpu_bound_work(self, data):
        """Simulate CPU-bound processing"""
        # Simulate quantum state calculation
        import hashlib
        result = hashlib.sha256(str(data).encode()).hexdigest()
        time.sleep(0.05)  # Simulate computation
        return result[:8]
        
    async def test_async_file_operations(self):
        """Test async file I/O"""
        test_file = self.memories_folder / "async_test.json"
        test_data = {
            'timestamp': datetime.now().isoformat(),
            'test': 'async file operation',
            'quantum_state': 'superposition'
        }
        
        # Write asynchronously
        async with aiofiles.open(test_file, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(test_data, indent=2))
            
        # Read asynchronously
        async with aiofiles.open(test_file, 'r', encoding='utf-8') as f:
            content = await f.read()
            data = json.loads(content)
            
        return data
        
    async def test_concurrent_processing(self):
        """Test concurrent event processing"""
        print("\n🔄 Testing concurrent processing...")
        
        # Create test events
        events = []
        for i in range(20):
            events.append({
                'id': i,
                'type': 'test_event',
                'data': f'quantum_state_{i}'
            })
            
        # Process in batches
        batch_size = 5
        results = []
        
        for i in range(0, len(events), batch_size):
            batch = events[i:i+batch_size]
            print(f"  Processing batch {i//batch_size + 1}...")
            batch_results = await self.process_batch(batch)
            results.extend(batch_results)
            
        return results
        
    def cleanup(self):
        """Cleanup resources"""
        self.thread_pool.shutdown(wait=False)
        self.process_pool.shutdown(wait=False)

async def main():
    """Main test function"""
    print("🚀 Testing Async Quantum Memory Processing\n")
    
    processor = AsyncProcessor()
    
    # Test 1: Async file operations
    print("📁 Testing async file operations...")
    file_result = await processor.test_async_file_operations()
    print(f"  ✅ Successfully wrote and read async file: {file_result['quantum_state']}")
    
    # Test 2: Concurrent processing
    results = await processor.test_concurrent_processing()
    
    # Show statistics
    print(f"\n📊 Processing Statistics:")
    print(f"  - Events processed: {processor.stats['events_processed']}")
    print(f"  - Batches processed: {processor.stats['batches_processed']}")
    print(f"  - Last batch time: {processor.stats['processing_time']:.3f}s")
    print(f"  - Average per event: {processor.stats['processing_time']/5:.3f}s")
    
    # Show sample results
    print(f"\n🔍 Sample Results:")
    for result in results[:3]:
        print(f"  Event {result['event']['id']}: {result['result']}")
        
    # Cleanup
    processor.cleanup()
    
    print("\n✅ Async processing test complete!")
    print("\n💡 Key improvements demonstrated:")
    print("  - Concurrent event processing with asyncio")
    print("  - Async file I/O with aiofiles")
    print("  - Thread pool for CPU-bound tasks")
    print("  - Batch processing for efficiency")
    print("  - uvloop for enhanced performance")

if __name__ == "__main__":
    asyncio.run(main())