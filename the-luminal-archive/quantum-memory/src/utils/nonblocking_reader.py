#!/usr/bin/env python3
"""
Non-blocking file reader utility to prevent file lock conflicts
"""

import fcntl
import os
import time
import logging
from typing import Optional, Iterator, BinaryIO
from pathlib import Path

logger = logging.getLogger(__name__)

class NonBlockingFileReader:
    """Read files without blocking, preventing conflicts with other processes"""
    
    def __init__(self, filepath: str, position: int = 0):
        self.filepath = Path(filepath)
        self.position = position
        self.file_handle: Optional[BinaryIO] = None
        
    def __enter__(self):
        """Open file with non-blocking mode"""
        try:
            # Open in binary mode for better control
            self.file_handle = open(self.filepath, 'rb')
            
            # Set non-blocking mode
            fd = self.file_handle.fileno()
            flags = fcntl.fcntl(fd, fcntl.F_GETFL)
            fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
            
            # Try to get shared lock (non-exclusive)
            try:
                fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
            except BlockingIOError:
                logger.warning(f"File {self.filepath} is locked, reading anyway")
            
            # Seek to position if specified
            if self.position > 0:
                self.file_handle.seek(self.position)
                
            return self
            
        except Exception as e:
            if self.file_handle:
                self.file_handle.close()
            raise
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Clean up file handle"""
        if self.file_handle:
            try:
                # Try to release lock if we have one
                fd = self.file_handle.fileno()
                fcntl.flock(fd, fcntl.LOCK_UN)
            except:
                pass
            finally:
                self.file_handle.close()
    
    def read_lines(self, max_wait: float = 0.1) -> Iterator[str]:
        """Read lines from file with non-blocking behavior"""
        if not self.file_handle:
            raise RuntimeError("File not opened")
            
        buffer = b""
        wait_time = 0.0
        
        while True:
            try:
                # Try to read chunk
                chunk = self.file_handle.read(4096)
                
                if not chunk:
                    # No more data available
                    if buffer:
                        # Yield any remaining data
                        yield buffer.decode('utf-8', errors='replace')
                    break
                    
                buffer += chunk
                wait_time = 0.0  # Reset wait time on successful read
                
                # Process complete lines
                while b'\n' in buffer:
                    line, buffer = buffer.split(b'\n', 1)
                    yield line.decode('utf-8', errors='replace')
                    
            except BlockingIOError:
                # No data available right now
                if wait_time >= max_wait:
                    # Waited long enough, yield what we have
                    if buffer:
                        yield buffer.decode('utf-8', errors='replace')
                    break
                    
                time.sleep(0.01)  # Small sleep to avoid busy loop
                wait_time += 0.01
                
            except Exception as e:
                logger.error(f"Error reading file: {e}")
                break
    
    def get_position(self) -> int:
        """Get current file position"""
        if self.file_handle:
            return self.file_handle.tell()
        return self.position


def read_jsonl_nonblocking(filepath: str, start_position: int = 0) -> Iterator[tuple[str, int]]:
    """
    Read JSONL file without blocking
    
    Yields tuples of (line, new_position)
    """
    with NonBlockingFileReader(filepath, start_position) as reader:
        for line in reader.read_lines():
            line = line.strip()
            if line:
                yield line, reader.get_position()