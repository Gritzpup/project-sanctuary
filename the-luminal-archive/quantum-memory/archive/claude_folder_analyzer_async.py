#!/usr/bin/env python3
"""
Async-Enhanced Claude Folder Analyzer
Implements concurrent processing pipeline for improved performance
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional, Any
import json
import logging
from datetime import datetime
from collections import deque
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import sys

# Add quantum-memory to path
sys.path.append(str(Path(__file__).parent.parent / "src"))
sys.path.append(str(Path(__file__).parent))

# Import base analyzer
from claude_folder_analyzer_quantum import ClaudeFolderAnalyzerQuantum

# Try to use uvloop for better async performance
try:
    import uvloop
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
except ImportError:
    pass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AsyncQuantumFolderAnalyzer(ClaudeFolderAnalyzerQuantum):
    """
    Async-enhanced version of the quantum folder analyzer
    
    Features:
    - Concurrent event processing
    - Batch processing for efficiency
    - Async I/O operations
    - Thread pool for CPU-bound tasks
    - Process pool for heavy computation
    """
    
    def __init__(self):
        # Initialize parent class
        super().__init__()
        
        # Async components
        self.event_queue = asyncio.Queue(maxsize=1000)
        self.result_queue = asyncio.Queue()
        self.processing_tasks = []
        
        # Thread pools
        self.thread_pool = ThreadPoolExecutor(max_workers=4)
        self.process_pool = ProcessPoolExecutor(max_workers=2)
        
        # Batch processing
        self.batch_size = 10
        self.batch_timeout = 0.5  # seconds
        
        # Statistics
        self.stats = {
            'events_processed': 0,
            'batches_processed': 0,
            'errors': 0,
            'avg_processing_time': 0
        }
        
        # Start async event loop in background
        self.loop = asyncio.new_event_loop()
        self.async_thread = None
        
        logger.info("🚀 Async Quantum Folder Analyzer initialized")
        
    def start_async_processing(self):
        """Start the async processing loop"""
        import threading
        
        def run_async_loop():
            asyncio.set_event_loop(self.loop)
            self.loop.run_until_complete(self._async_main())
            
        self.async_thread = threading.Thread(target=run_async_loop, daemon=True)
        self.async_thread.start()
        logger.info("⚡ Async processing loop started")
        
    async def _async_main(self):
        """Main async processing loop"""
        # Start worker tasks
        workers = [
            asyncio.create_task(self._event_processor()),
            asyncio.create_task(self._batch_processor()),
            asyncio.create_task(self._result_processor()),
            asyncio.create_task(self._stats_reporter())
        ]
        
        # Run until cancelled
        try:
            await asyncio.gather(*workers)
        except asyncio.CancelledError:
            logger.info("Async processing stopped")
            
    def on_modified(self, event):
        """Override to queue events for async processing"""
        if event.is_directory:
            return
            
        # Queue event for async processing
        try:
            # Use non-blocking put
            self.loop.call_soon_threadsafe(
                self.event_queue.put_nowait,
                {
                    'type': 'modified',
                    'path': event.src_path,
                    'timestamp': time.time()
                }
            )
        except asyncio.QueueFull:
            logger.warning(f"Event queue full, dropping event: {event.src_path}")
            
    async def _event_processor(self):
        """Process incoming file events"""
        batch = []
        last_batch_time = time.time()
        
        while True:
            try:
                # Try to get event with timeout for batching
                timeout = self.batch_timeout - (time.time() - last_batch_time)
                if timeout <= 0:
                    timeout = 0.01
                    
                event = await asyncio.wait_for(
                    self.event_queue.get(),
                    timeout=timeout
                )
                batch.append(event)
                
                # Process batch if full
                if len(batch) >= self.batch_size:
                    await self._process_event_batch(batch)
                    batch = []
                    last_batch_time = time.time()
                    
            except asyncio.TimeoutError:
                # Process partial batch on timeout
                if batch:
                    await self._process_event_batch(batch)
                    batch = []
                    last_batch_time = time.time()
                    
    async def _process_event_batch(self, events: List[Dict]):
        """Process a batch of events concurrently"""
        start_time = time.time()
        
        # Group events by type
        conversation_events = []
        todo_events = []
        entity_events = []
        
        for event in events:
            path = event['path']
            if path.endswith('.jsonl'):
                conversation_events.append(event)
            elif 'todos' in path and path.endswith('.json'):
                todo_events.append(event)
            elif str(self.entity_folder) in path and path.endswith('.json'):
                entity_events.append(event)
                
        # Process each type concurrently
        tasks = []
        
        if conversation_events:
            tasks.append(self._process_conversations_async(conversation_events))
        if todo_events:
            tasks.append(self._process_todos_async(todo_events))
        if entity_events:
            tasks.append(self._process_entities_async(entity_events))
            
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Queue results
            for result in results:
                if not isinstance(result, Exception):
                    await self.result_queue.put(result)
                else:
                    logger.error(f"Batch processing error: {result}")
                    self.stats['errors'] += 1
                    
        # Update statistics
        processing_time = time.time() - start_time
        self.stats['batches_processed'] += 1
        self.stats['events_processed'] += len(events)
        
        # Update rolling average
        avg = self.stats['avg_processing_time']
        self.stats['avg_processing_time'] = (avg * 0.9) + (processing_time * 0.1)
        
    async def _process_conversations_async(self, events: List[Dict]) -> Dict:
        """Process conversation files asynchronously"""
        results = {'type': 'conversations', 'processed': []}
        
        # Use conversation buffer's async method
        for event in events:
            try:
                path = Path(event['path'])
                
                # Read new messages asynchronously
                new_messages = await self.conversation_buffer.read_new_messages_async(path)
                
                if new_messages:
                    # Process in thread pool (CPU-bound)
                    loop = asyncio.get_event_loop()
                    analysis = await loop.run_in_executor(
                        self.thread_pool,
                        self._analyze_messages_sync,
                        new_messages
                    )
                    
                    results['processed'].append({
                        'file': path.name,
                        'messages': len(new_messages),
                        'analysis': analysis
                    })
                    
            except Exception as e:
                logger.error(f"Error processing conversation {event['path']}: {e}")
                
        return results
        
    def _analyze_messages_sync(self, messages: List[Dict]) -> Dict:
        """Synchronous message analysis for thread pool"""
        # This runs in thread pool, so we can use the synchronous emollama
        try:
            # Get last N messages for analysis
            recent_messages = messages[-10:]  # Analyze last 10 messages
            
            # Extract text content
            texts = []
            for msg in recent_messages:
                if isinstance(msg.get('message'), dict):
                    content = msg['message'].get('content', '')
                    if isinstance(content, str):
                        texts.append(content)
                    elif isinstance(content, list):
                        # Handle multi-part content
                        for part in content:
                            if isinstance(part, dict) and 'text' in part:
                                texts.append(part['text'])
                                
            combined_text = " ".join(texts)
            
            # Use emollama for analysis
            result = self.emollama.analyze_for_memories_and_work(
                combined_text,
                extract_work=True
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error in message analysis: {e}")
            return {}
            
    async def _process_todos_async(self, events: List[Dict]) -> Dict:
        """Process todo files asynchronously"""
        results = {'type': 'todos', 'processed': []}
        
        for event in events:
            try:
                path = Path(event['path'])
                
                # Read file asynchronously
                import aiofiles
                async with aiofiles.open(path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    todo_data = json.loads(content)
                    
                # Process todos
                if isinstance(todo_data, list):
                    todos = todo_data
                elif isinstance(todo_data, dict):
                    todos = todo_data.get('todos', todo_data.get('items', []))
                else:
                    todos = []
                    
                # Count by status
                stats = {
                    'total': len(todos),
                    'active': sum(1 for t in todos if isinstance(t, dict) and t.get('status') == 'in_progress'),
                    'pending': sum(1 for t in todos if isinstance(t, dict) and t.get('status') == 'pending'),
                    'completed': sum(1 for t in todos if isinstance(t, dict) and t.get('status') == 'completed')
                }
                
                results['processed'].append({
                    'file': path.name,
                    'stats': stats
                })
                
            except Exception as e:
                logger.error(f"Error processing todo {event['path']}: {e}")
                
        return results
        
    async def _process_entities_async(self, events: List[Dict]) -> Dict:
        """Process entity files asynchronously"""
        results = {'type': 'entities', 'processed': []}
        
        for event in events:
            try:
                path = Path(event['path'])
                
                # Read file asynchronously
                import aiofiles
                async with aiofiles.open(path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    entity_data = json.loads(content)
                    
                results['processed'].append({
                    'file': path.name,
                    'entity': entity_data.get('entity_name', 'unknown')
                })
                
            except Exception as e:
                logger.error(f"Error processing entity {event['path']}: {e}")
                
        return results
        
    async def _batch_processor(self):
        """Process results in batches for efficiency"""
        batch = []
        last_process_time = time.time()
        
        while True:
            try:
                # Collect results with timeout
                timeout = 1.0 - (time.time() - last_process_time)
                if timeout <= 0:
                    timeout = 0.01
                    
                result = await asyncio.wait_for(
                    self.result_queue.get(),
                    timeout=timeout
                )
                batch.append(result)
                
                # Process batch if large enough
                if len(batch) >= 5:
                    await self._process_result_batch(batch)
                    batch = []
                    last_process_time = time.time()
                    
            except asyncio.TimeoutError:
                # Process partial batch
                if batch:
                    await self._process_result_batch(batch)
                    batch = []
                    last_process_time = time.time()
                    
    async def _process_result_batch(self, results: List[Dict]):
        """Process a batch of results"""
        # Update quantum state
        await self._update_quantum_state_async(results)
        
        # Update memories
        await self._update_memories_async(results)
        
        # Update work summary
        await self._update_work_summary_async(results)
        
    async def _result_processor(self):
        """Process analysis results and update quantum state"""
        while True:
            try:
                result = await self.result_queue.get()
                
                # Process based on type
                if result['type'] == 'conversations':
                    for conv in result['processed']:
                        logger.info(f"Processed {conv['messages']} messages from {conv['file']}")
                        
                elif result['type'] == 'todos':
                    for todo in result['processed']:
                        logger.info(f"Todo stats for {todo['file']}: {todo['stats']}")
                        
                elif result['type'] == 'entities':
                    for entity in result['processed']:
                        logger.info(f"Entity update: {entity['entity']} ({entity['file']})")
                        
            except Exception as e:
                logger.error(f"Error processing result: {e}")
                
    async def _stats_reporter(self):
        """Periodically report processing statistics"""
        while True:
            await asyncio.sleep(60)  # Report every minute
            
            logger.info(f"""
            📊 Async Processing Statistics:
            - Events processed: {self.stats['events_processed']}
            - Batches processed: {self.stats['batches_processed']}
            - Errors: {self.stats['errors']}
            - Avg processing time: {self.stats['avg_processing_time']:.3f}s
            """)
            
    async def _update_quantum_state_async(self, results: List[Dict]):
        """Update quantum state asynchronously"""
        # Run in thread pool since it's CPU-bound
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            self.thread_pool,
            self._update_quantum_state
        )
        
    async def _update_memories_async(self, results: List[Dict]):
        """Update memory files asynchronously"""
        import aiofiles
        from datetime import datetime
        
        # Collect all memory updates
        memory_updates = []
        
        for result in results:
            if result['type'] == 'conversations':
                for conv in result.get('processed', []):
                    analysis = conv.get('analysis', {})
                    
                    # Extract memories from emotional analysis
                    if 'emotional_state' in analysis:
                        memory_updates.append({
                            'timestamp': datetime.now().isoformat(),
                            'source': conv['file'],
                            'type': 'emotional',
                            'content': analysis['emotional_state'],
                            'confidence': analysis.get('confidence', 0.8)
                        })
                    
                    # Extract key insights
                    if 'key_insights' in analysis:
                        for insight in analysis['key_insights']:
                            memory_updates.append({
                                'timestamp': datetime.now().isoformat(),
                                'source': conv['file'],
                                'type': 'insight',
                                'content': insight,
                                'confidence': 0.9
                            })
        
        if memory_updates:
            # Update memories file asynchronously
            memory_file = self.memories_folder / f"memories_{datetime.now().strftime('%Y%m%d')}.json"
            
            try:
                # Read existing memories
                existing = []
                if memory_file.exists():
                    async with aiofiles.open(memory_file, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        if content.strip():
                            existing = json.loads(content)
                
                # Append new memories
                existing.extend(memory_updates)
                
                # Write back
                async with aiofiles.open(memory_file, 'w', encoding='utf-8') as f:
                    await f.write(json.dumps(existing, indent=2))
                    
                logger.info(f"✨ Updated memories with {len(memory_updates)} new entries")
                
            except Exception as e:
                logger.error(f"Error updating memories: {e}")
        
    async def _update_work_summary_async(self, results: List[Dict]):
        """Update work summary asynchronously"""
        import aiofiles
        from datetime import datetime
        
        # Collect work-related updates
        work_updates = {
            'todos_processed': [],
            'conversations_analyzed': [],
            'entities_updated': []
        }
        
        for result in results:
            if result['type'] == 'todos':
                for todo in result.get('processed', []):
                    work_updates['todos_processed'].append({
                        'file': todo['file'],
                        'stats': todo['stats'],
                        'timestamp': datetime.now().isoformat()
                    })
            
            elif result['type'] == 'conversations':
                for conv in result.get('processed', []):
                    analysis = conv.get('analysis', {})
                    if 'work_context' in analysis:
                        work_updates['conversations_analyzed'].append({
                            'file': conv['file'],
                            'work_items': analysis['work_context'],
                            'timestamp': datetime.now().isoformat()
                        })
            
            elif result['type'] == 'entities':
                for entity in result.get('processed', []):
                    work_updates['entities_updated'].append({
                        'entity': entity['entity'],
                        'file': entity['file'],
                        'timestamp': datetime.now().isoformat()
                    })
        
        # Update work summary file
        work_summary_file = self.memories_folder / 'work_summary_24h.json'
        
        try:
            # Read existing summary
            existing_summary = {}
            if work_summary_file.exists():
                async with aiofiles.open(work_summary_file, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    if content.strip():
                        existing_summary = json.loads(content)
            
            # Update with new data
            if 'async_processing' not in existing_summary:
                existing_summary['async_processing'] = {
                    'started': datetime.now().isoformat(),
                    'total_updates': 0
                }
            
            # Update counters
            async_data = existing_summary['async_processing']
            async_data['last_update'] = datetime.now().isoformat()
            async_data['total_updates'] += sum(len(v) for v in work_updates.values())
            
            # Add recent activity
            if 'recent_activity' not in async_data:
                async_data['recent_activity'] = []
            
            # Add summary of this batch
            if any(len(v) > 0 for v in work_updates.values()):
                async_data['recent_activity'].append({
                    'timestamp': datetime.now().isoformat(),
                    'todos': len(work_updates['todos_processed']),
                    'conversations': len(work_updates['conversations_analyzed']),
                    'entities': len(work_updates['entities_updated'])
                })
            
            # Keep only last 100 activities
            async_data['recent_activity'] = async_data['recent_activity'][-100:]
            
            # Update current todos if we processed any
            if work_updates['todos_processed']:
                latest_todo = work_updates['todos_processed'][-1]
                existing_summary['current_todos'] = latest_todo['stats']
            
            # Write back
            async with aiofiles.open(work_summary_file, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(existing_summary, indent=2))
                
            if any(len(v) > 0 for v in work_updates.values()):
                logger.info(f"📊 Updated work summary: {sum(len(v) for v in work_updates.values())} items")
                
        except Exception as e:
            logger.error(f"Error updating work summary: {e}")
        
    def stop(self):
        """Stop async processing"""
        if self.loop and self.loop.is_running():
            self.loop.call_soon_threadsafe(self.loop.stop)
            
        if self.async_thread:
            self.async_thread.join(timeout=5.0)
            
        # Shutdown pools
        self.thread_pool.shutdown(wait=False)
        self.process_pool.shutdown(wait=False)
        
        logger.info("Async processing stopped")


def main():
    """Main entry point with async support"""
    # Create async analyzer
    analyzer = AsyncQuantumFolderAnalyzer()
    
    # Start async processing
    analyzer.start_async_processing()
    
    # Set up file monitoring
    observer = Observer()
    observer.schedule(analyzer, str(analyzer.claude_folder), recursive=True)
    observer.schedule(analyzer, str(analyzer.entity_folder), recursive=True)
    observer.start()
    
    print("🔍 Async monitoring started. Press Ctrl+C to stop.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        analyzer.stop()
        print("\n✅ Monitoring stopped.")
        
    observer.join()


if __name__ == "__main__":
    main()