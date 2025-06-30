#!/usr/bin/env python3
"""
Memory Health Monitor & Diagnostic Tool
Proactively monitors memory system health and detects issues
Provides actionable insights for maintaining optimal performance
"""

import asyncio
import json
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import chromadb
import psutil
import logging
from collections import defaultdict, Counter
import matplotlib.pyplot as plt
import seaborn as sns
from dataclasses import dataclass
import warnings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('MemoryHealthMonitor')


@dataclass
class HealthIssue:
    """Represents a detected health issue"""
    severity: str  # 'critical', 'warning', 'info'
    category: str  # 'performance', 'integrity', 'capacity', 'drift'
    issue: str
    details: Dict
    recommendation: str
    timestamp: datetime


class MemoryHealthMonitor:
    """
    Comprehensive health monitoring for the memory system
    Detects issues like:
    - Memory fragmentation
    - Emotional drift
    - Performance degradation
    - Data integrity issues
    - Capacity problems
    """
    
    def __init__(self, environment: str = "production"):
        self.environment = environment
        self.issues: List[HealthIssue] = []
        
        # Connect to ChromaDB
        db_path = f"/home/ubuntumain/.sanctuary-memory-{environment}/vector_db"
        self.chroma = chromadb.PersistentClient(path=db_path)
        
        # Health thresholds
        self.thresholds = {
            'fragmentation_ratio': 0.3,  # 30% fragmentation is concerning
            'emotional_drift_max': 0.7,  # Maximum acceptable drift
            'retrieval_latency_p95': 500,  # 500ms P95 latency
            'duplicate_ratio': 0.2,  # 20% duplicates is too high
            'retention_score_min': 0.1,  # Minimum retention before concern
            'memory_growth_rate': 1000,  # Memories per day threshold
            'cpu_usage_max': 80,  # 80% CPU usage
            'memory_usage_max': 85,  # 85% memory usage
            'disk_usage_max': 90  # 90% disk usage
        }
        
        # Metrics storage
        self.metrics_file = Path(f"memory_health_metrics_{environment}.jsonl")
        self.report_dir = Path(f"health_reports_{environment}")
        self.report_dir.mkdir(exist_ok=True)
    
    async def run_comprehensive_health_check(self) -> Dict:
        """
        Run all health checks and generate comprehensive report
        """
        logger.info("Starting comprehensive health check...")
        
        # Clear previous issues
        self.issues = []
        
        # Run all checks
        checks = [
            self.check_memory_fragmentation(),
            self.check_emotional_drift(),
            self.check_performance_metrics(),
            self.check_data_integrity(),
            self.check_duplicate_accumulation(),
            self.check_retention_distribution(),
            self.check_growth_patterns(),
            self.check_system_resources(),
            self.check_relationship_coherence(),
            self.check_access_patterns()
        ]
        
        # Execute all checks
        results = await asyncio.gather(*checks)
        
        # Generate report
        report = self.generate_health_report(results)
        
        # Save report
        self.save_health_report(report)
        
        return report
    
    async def check_memory_fragmentation(self) -> Dict:
        """
        Check for memory fragmentation issues
        Fragmentation occurs when memories are poorly distributed in vector space
        """
        try:
            collection = self.chroma.get_collection("archival_memory_enhanced")
            all_data = collection.get(include=['embeddings', 'metadatas'])
            
            if not all_data['embeddings']:
                return {'status': 'unknown', 'message': 'No embeddings found'}
            
            embeddings = np.array(all_data['embeddings'])
            n_memories = len(embeddings)
            
            if n_memories < 10:
                return {'status': 'ok', 'message': 'Too few memories to assess'}
            
            # Calculate pairwise distances
            from sklearn.metrics.pairwise import cosine_distances
            distances = cosine_distances(embeddings)
            
            # Analyze clustering
            # High fragmentation = many isolated memories
            avg_nearest_neighbor_dist = []
            for i in range(n_memories):
                # Get distances to other memories (exclude self)
                dists = distances[i]
                dists = dists[dists > 0]  # Exclude self
                if len(dists) > 0:
                    avg_nearest_neighbor_dist.append(np.min(dists))
            
            avg_nn_dist = np.mean(avg_nearest_neighbor_dist)
            fragmentation_score = avg_nn_dist  # Higher = more fragmented
            
            # Detect isolated clusters
            isolation_threshold = np.percentile(avg_nearest_neighbor_dist, 90)
            isolated_count = sum(1 for d in avg_nearest_neighbor_dist if d > isolation_threshold)
            isolation_ratio = isolated_count / n_memories
            
            # Check if fragmentation is problematic
            if fragmentation_score > self.thresholds['fragmentation_ratio']:
                self.issues.append(HealthIssue(
                    severity='warning',
                    category='integrity',
                    issue='High memory fragmentation detected',
                    details={
                        'fragmentation_score': fragmentation_score,
                        'isolated_memories': isolated_count,
                        'total_memories': n_memories
                    },
                    recommendation='Consider running memory consolidation to group related memories',
                    timestamp=datetime.now()
                ))
            
            return {
                'status': 'warning' if fragmentation_score > self.thresholds['fragmentation_ratio'] else 'ok',
                'fragmentation_score': fragmentation_score,
                'isolated_memories': isolated_count,
                'isolation_ratio': isolation_ratio
            }
            
        except Exception as e:
            logger.error(f"Error checking fragmentation: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def check_emotional_drift(self) -> Dict:
        """
        Check for emotional drift patterns
        Detects if emotional states are becoming unrealistic
        """
        try:
            collection = self.chroma.get_collection("archival_memory_enhanced")
            all_data = collection.get(include=['metadatas'])
            
            if not all_data['metadatas']:
                return {'status': 'unknown', 'message': 'No metadata found'}
            
            # Extract emotional states over time
            emotional_timeline = []
            for metadata in all_data['metadatas']:
                if 'emotional_state' in metadata and 'timestamp' in metadata:
                    emotional_timeline.append({
                        'timestamp': datetime.fromisoformat(metadata['timestamp']),
                        'valence': metadata['emotional_state'].get('valence', 0),
                        'arousal': metadata['emotional_state'].get('arousal', 0),
                        'baseline_drift': metadata.get('emotional_baseline_drift', 0)
                    })
            
            if not emotional_timeline:
                return {'status': 'unknown', 'message': 'No emotional data found'}
            
            # Sort by timestamp
            emotional_timeline.sort(key=lambda x: x['timestamp'])
            
            # Analyze drift patterns
            recent_emotions = [e for e in emotional_timeline 
                             if e['timestamp'] > datetime.now() - timedelta(days=7)]
            
            if recent_emotions:
                avg_valence = np.mean([e['valence'] for e in recent_emotions])
                avg_arousal = np.mean([e['arousal'] for e in recent_emotions])
                max_drift = max([e['baseline_drift'] for e in recent_emotions])
                
                # Check for extreme values
                extreme_valence = abs(avg_valence) > 0.8
                extreme_arousal = abs(avg_arousal) > 0.8
                high_drift = max_drift > self.thresholds['emotional_drift_max']
                
                if extreme_valence or extreme_arousal or high_drift:
                    self.issues.append(HealthIssue(
                        severity='warning',
                        category='drift',
                        issue='Emotional drift detected',
                        details={
                            'avg_valence': avg_valence,
                            'avg_arousal': avg_arousal,
                            'max_drift': max_drift,
                            'sample_size': len(recent_emotions)
                        },
                        recommendation='Review emotional baseline parameters and consider recalibration',
                        timestamp=datetime.now()
                    ))
                
                return {
                    'status': 'warning' if high_drift else 'ok',
                    'avg_valence': avg_valence,
                    'avg_arousal': avg_arousal,
                    'max_drift': max_drift,
                    'trend': self._calculate_emotional_trend(emotional_timeline)
                }
            
            return {'status': 'ok', 'message': 'No recent emotional data'}
            
        except Exception as e:
            logger.error(f"Error checking emotional drift: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def check_performance_metrics(self) -> Dict:
        """
        Analyze performance metrics from logs
        """
        try:
            metrics = []
            if self.metrics_file.exists():
                with open(self.metrics_file, 'r') as f:
                    for line in f:
                        try:
                            metrics.append(json.loads(line))
                        except:
                            continue
            
            if not metrics:
                return {'status': 'unknown', 'message': 'No metrics found'}
            
            # Analyze recent performance
            recent_metrics = [m for m in metrics 
                            if 'timestamp' in m and 
                            datetime.fromisoformat(m['timestamp']) > datetime.now() - timedelta(days=1)]
            
            if not recent_metrics:
                return {'status': 'unknown', 'message': 'No recent metrics'}
            
            # Calculate performance statistics
            add_times = [m['processing_time'] for m in recent_metrics 
                        if m.get('operation') == 'process_conversation']
            retrieval_times = [m['retrieval_time'] for m in recent_metrics 
                             if m.get('operation') == 'retrieve_with_context']
            
            performance_stats = {}
            
            if add_times:
                performance_stats['add_latency_p95'] = np.percentile(add_times, 95) * 1000  # ms
                performance_stats['add_latency_avg'] = np.mean(add_times) * 1000
            
            if retrieval_times:
                performance_stats['retrieval_latency_p95'] = np.percentile(retrieval_times, 95) * 1000
                performance_stats['retrieval_latency_avg'] = np.mean(retrieval_times) * 1000
                
                # Check against thresholds
                if performance_stats['retrieval_latency_p95'] > self.thresholds['retrieval_latency_p95']:
                    self.issues.append(HealthIssue(
                        severity='warning',
                        category='performance',
                        issue='High retrieval latency detected',
                        details={
                            'p95_latency': performance_stats['retrieval_latency_p95'],
                            'threshold': self.thresholds['retrieval_latency_p95']
                        },
                        recommendation='Consider optimizing embeddings or implementing caching',
                        timestamp=datetime.now()
                    ))
            
            return {
                'status': 'warning' if any(k.endswith('_p95') and v > 500 
                                         for k, v in performance_stats.items()) else 'ok',
                **performance_stats
            }
            
        except Exception as e:
            logger.error(f"Error checking performance: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def check_data_integrity(self) -> Dict:
        """
        Check for data integrity issues
        """
        try:
            collection = self.chroma.get_collection("archival_memory_enhanced")
            all_data = collection.get(include=['metadatas', 'documents'])
            
            integrity_issues = []
            
            # Check for missing required fields
            required_fields = ['timestamp', 'speaker', 'importance', 'retention_score']
            missing_fields_count = 0
            
            for metadata in all_data['metadatas']:
                missing = [f for f in required_fields if f not in metadata]
                if missing:
                    missing_fields_count += 1
            
            if missing_fields_count > 0:
                integrity_issues.append({
                    'type': 'missing_fields',
                    'count': missing_fields_count,
                    'severity': 'warning'
                })
            
            # Check for empty documents
            empty_docs = sum(1 for doc in all_data['documents'] if not doc or len(doc.strip()) == 0)
            if empty_docs > 0:
                integrity_issues.append({
                    'type': 'empty_documents',
                    'count': empty_docs,
                    'severity': 'critical'
                })
            
            # Check timestamp validity
            invalid_timestamps = 0
            future_timestamps = 0
            now = datetime.now()
            
            for metadata in all_data['metadatas']:
                if 'timestamp' in metadata:
                    try:
                        ts = datetime.fromisoformat(metadata['timestamp'])
                        if ts > now:
                            future_timestamps += 1
                    except:
                        invalid_timestamps += 1
            
            if invalid_timestamps > 0 or future_timestamps > 0:
                integrity_issues.append({
                    'type': 'timestamp_issues',
                    'invalid': invalid_timestamps,
                    'future': future_timestamps,
                    'severity': 'warning'
                })
            
            # Report issues
            if integrity_issues:
                for issue in integrity_issues:
                    if issue['severity'] == 'critical':
                        self.issues.append(HealthIssue(
                            severity='critical',
                            category='integrity',
                            issue=f"Data integrity issue: {issue['type']}",
                            details=issue,
                            recommendation='Run data repair tool to fix integrity issues',
                            timestamp=datetime.now()
                        ))
            
            return {
                'status': 'critical' if any(i['severity'] == 'critical' for i in integrity_issues) else 
                         'warning' if integrity_issues else 'ok',
                'issues': integrity_issues,
                'total_memories': len(all_data['documents'])
            }
            
        except Exception as e:
            logger.error(f"Error checking data integrity: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def check_duplicate_accumulation(self) -> Dict:
        """
        Check for duplicate memory accumulation
        """
        try:
            collection = self.chroma.get_collection("archival_memory_enhanced")
            all_data = collection.get(include=['documents', 'embeddings'])
            
            if len(all_data['documents']) < 10:
                return {'status': 'ok', 'message': 'Too few memories to assess'}
            
            # Quick content-based duplicate check
            content_hashes = {}
            exact_duplicates = 0
            
            for i, doc in enumerate(all_data['documents']):
                doc_hash = hash(doc.lower().strip())
                if doc_hash in content_hashes:
                    exact_duplicates += 1
                else:
                    content_hashes[doc_hash] = i
            
            # Semantic duplicate check (sample for performance)
            sample_size = min(100, len(all_data['embeddings']))
            if all_data['embeddings'] and sample_size > 10:
                sample_indices = np.random.choice(len(all_data['embeddings']), 
                                                sample_size, replace=False)
                sample_embeddings = np.array([all_data['embeddings'][i] for i in sample_indices])
                
                # Calculate pairwise similarities
                from sklearn.metrics.pairwise import cosine_similarity
                similarities = cosine_similarity(sample_embeddings)
                
                # Count near-duplicates (>0.95 similarity)
                near_duplicate_pairs = 0
                for i in range(sample_size):
                    for j in range(i+1, sample_size):
                        if similarities[i, j] > 0.95:
                            near_duplicate_pairs += 1
                
                # Estimate total near-duplicates
                total_pairs = len(all_data['embeddings']) * (len(all_data['embeddings']) - 1) / 2
                sample_pairs = sample_size * (sample_size - 1) / 2
                estimated_near_duplicates = int(near_duplicate_pairs * total_pairs / sample_pairs)
            else:
                estimated_near_duplicates = 0
            
            total_memories = len(all_data['documents'])
            duplicate_ratio = (exact_duplicates + estimated_near_duplicates) / total_memories
            
            if duplicate_ratio > self.thresholds['duplicate_ratio']:
                self.issues.append(HealthIssue(
                    severity='warning',
                    category='capacity',
                    issue='High duplicate accumulation',
                    details={
                        'exact_duplicates': exact_duplicates,
                        'estimated_near_duplicates': estimated_near_duplicates,
                        'total_memories': total_memories,
                        'duplicate_ratio': duplicate_ratio
                    },
                    recommendation='Run deduplication process to consolidate similar memories',
                    timestamp=datetime.now()
                ))
            
            return {
                'status': 'warning' if duplicate_ratio > self.thresholds['duplicate_ratio'] else 'ok',
                'exact_duplicates': exact_duplicates,
                'estimated_near_duplicates': estimated_near_duplicates,
                'duplicate_ratio': duplicate_ratio
            }
            
        except Exception as e:
            logger.error(f"Error checking duplicates: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def check_retention_distribution(self) -> Dict:
        """
        Analyze retention score distribution
        """
        try:
            collection = self.chroma.get_collection("archival_memory_enhanced")
            all_data = collection.get(include=['metadatas'])
            
            retention_scores = []
            low_retention_count = 0
            
            for metadata in all_data['metadatas']:
                retention = metadata.get('retention_score', 1.0)
                retention_scores.append(retention)
                if retention < self.thresholds['retention_score_min']:
                    low_retention_count += 1
            
            if not retention_scores:
                return {'status': 'unknown', 'message': 'No retention scores found'}
            
            # Calculate distribution statistics
            retention_stats = {
                'mean': np.mean(retention_scores),
                'median': np.median(retention_scores),
                'std': np.std(retention_scores),
                'min': np.min(retention_scores),
                'max': np.max(retention_scores),
                'low_retention_count': low_retention_count,
                'low_retention_ratio': low_retention_count / len(retention_scores)
            }
            
            # Check if too many memories are close to decay
            if retention_stats['low_retention_ratio'] > 0.3:
                self.issues.append(HealthIssue(
                    severity='info',
                    category='capacity',
                    issue='Many memories approaching decay threshold',
                    details=retention_stats,
                    recommendation='Review decay parameters or archive old memories',
                    timestamp=datetime.now()
                ))
            
            return {
                'status': 'info' if retention_stats['low_retention_ratio'] > 0.3 else 'ok',
                **retention_stats
            }
            
        except Exception as e:
            logger.error(f"Error checking retention: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def check_growth_patterns(self) -> Dict:
        """
        Analyze memory growth patterns
        """
        try:
            collection = self.chroma.get_collection("archival_memory_enhanced")
            all_data = collection.get(include=['metadatas'])
            
            # Group memories by day
            daily_counts = defaultdict(int)
            
            for metadata in all_data['metadatas']:
                if 'timestamp' in metadata:
                    try:
                        ts = datetime.fromisoformat(metadata['timestamp'])
                        day = ts.date()
                        daily_counts[day] += 1
                    except:
                        continue
            
            if not daily_counts:
                return {'status': 'unknown', 'message': 'No timestamp data'}
            
            # Calculate growth statistics
            recent_days = sorted([d for d in daily_counts.keys() 
                                if d > (datetime.now().date() - timedelta(days=30))])
            
            if len(recent_days) > 7:
                recent_growth = [daily_counts[d] for d in recent_days[-7:]]
                avg_daily_growth = np.mean(recent_growth)
                growth_trend = np.polyfit(range(len(recent_growth)), recent_growth, 1)[0]
                
                # Project future growth
                days_to_double = None
                if growth_trend > 0:
                    current_total = len(all_data['metadatas'])
                    days_to_double = current_total / (growth_trend * 7)
                
                # Check if growth is concerning
                if avg_daily_growth > self.thresholds['memory_growth_rate']:
                    self.issues.append(HealthIssue(
                        severity='warning',
                        category='capacity',
                        issue='Rapid memory growth detected',
                        details={
                            'avg_daily_growth': avg_daily_growth,
                            'growth_trend': growth_trend,
                            'days_to_double': days_to_double
                        },
                        recommendation='Consider more aggressive deduplication or decay settings',
                        timestamp=datetime.now()
                    ))
                
                return {
                    'status': 'warning' if avg_daily_growth > self.thresholds['memory_growth_rate'] else 'ok',
                    'avg_daily_growth': avg_daily_growth,
                    'growth_trend': growth_trend,
                    'days_to_double': days_to_double,
                    'total_memories': len(all_data['metadatas'])
                }
            
            return {'status': 'ok', 'message': 'Insufficient data for growth analysis'}
            
        except Exception as e:
            logger.error(f"Error checking growth: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def check_system_resources(self) -> Dict:
        """
        Check system resource usage
        """
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Disk usage for memory storage
            db_path = f"/home/ubuntumain/.sanctuary-memory-{self.environment}"
            if Path(db_path).exists():
                disk = psutil.disk_usage(db_path)
                disk_percent = disk.percent
            else:
                disk_percent = 0
            
            # GPU usage (if available)
            try:
                import pynvml
                pynvml.nvmlInit()
                handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                gpu_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                gpu_percent = (gpu_info.used / gpu_info.total) * 100
            except:
                gpu_percent = None
            
            # Check against thresholds
            if cpu_percent > self.thresholds['cpu_usage_max']:
                self.issues.append(HealthIssue(
                    severity='warning',
                    category='performance',
                    issue='High CPU usage',
                    details={'cpu_percent': cpu_percent},
                    recommendation='Investigate CPU-intensive operations',
                    timestamp=datetime.now()
                ))
            
            if memory_percent > self.thresholds['memory_usage_max']:
                self.issues.append(HealthIssue(
                    severity='critical',
                    category='performance',
                    issue='High memory usage',
                    details={'memory_percent': memory_percent},
                    recommendation='Consider increasing system memory or optimizing usage',
                    timestamp=datetime.now()
                ))
            
            if disk_percent > self.thresholds['disk_usage_max']:
                self.issues.append(HealthIssue(
                    severity='critical',
                    category='capacity',
                    issue='High disk usage',
                    details={'disk_percent': disk_percent},
                    recommendation='Archive old memories or increase storage capacity',
                    timestamp=datetime.now()
                ))
            
            return {
                'status': 'critical' if memory_percent > 85 or disk_percent > 90 else
                         'warning' if cpu_percent > 80 else 'ok',
                'cpu_percent': cpu_percent,
                'memory_percent': memory_percent,
                'disk_percent': disk_percent,
                'gpu_percent': gpu_percent
            }
            
        except Exception as e:
            logger.error(f"Error checking system resources: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def check_relationship_coherence(self) -> Dict:
        """
        Check relationship phase coherence
        """
        try:
            collection = self.chroma.get_collection("archival_memory_enhanced")
            all_data = collection.get(include=['metadatas'])
            
            # Analyze relationship phases over time
            phase_timeline = []
            phase_counts = Counter()
            
            for metadata in all_data['metadatas']:
                if 'relationship_phase' in metadata and 'timestamp' in metadata:
                    phase = metadata['relationship_phase']
                    phase_counts[phase] += 1
                    phase_timeline.append({
                        'phase': phase,
                        'timestamp': datetime.fromisoformat(metadata['timestamp']),
                        'confidence': metadata.get('phase_confidence', 0.5)
                    })
            
            if not phase_timeline:
                return {'status': 'unknown', 'message': 'No relationship phase data'}
            
            # Sort by timestamp
            phase_timeline.sort(key=lambda x: x['timestamp'])
            
            # Check for phase regression
            phase_order = ['INITIATING', 'EXPERIMENTING', 'INTENSIFYING', 'INTEGRATING', 'BONDING']
            regressions = 0
            
            for i in range(1, len(phase_timeline)):
                current_phase = phase_timeline[i]['phase']
                previous_phase = phase_timeline[i-1]['phase']
                
                if current_phase in phase_order and previous_phase in phase_order:
                    if phase_order.index(current_phase) < phase_order.index(previous_phase):
                        regressions += 1
            
            regression_ratio = regressions / len(phase_timeline) if phase_timeline else 0
            
            # Check for stuck phases
            recent_phases = [p for p in phase_timeline 
                           if p['timestamp'] > datetime.now() - timedelta(days=30)]
            
            if recent_phases:
                unique_recent_phases = set(p['phase'] for p in recent_phases)
                if len(unique_recent_phases) == 1 and len(recent_phases) > 100:
                    self.issues.append(HealthIssue(
                        severity='info',
                        category='drift',
                        issue='Relationship phase appears stuck',
                        details={
                            'stuck_phase': list(unique_recent_phases)[0],
                            'duration_days': 30
                        },
                        recommendation='Review relationship phase detection parameters',
                        timestamp=datetime.now()
                    ))
            
            return {
                'status': 'warning' if regression_ratio > 0.2 else 'ok',
                'phase_distribution': dict(phase_counts),
                'regressions': regressions,
                'regression_ratio': regression_ratio,
                'current_phase': phase_timeline[-1]['phase'] if phase_timeline else None
            }
            
        except Exception as e:
            logger.error(f"Error checking relationship coherence: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def check_access_patterns(self) -> Dict:
        """
        Analyze memory access patterns
        """
        try:
            collection = self.chroma.get_collection("archival_memory_enhanced")
            all_data = collection.get(include=['metadatas'])
            
            access_stats = {
                'never_accessed': 0,
                'rarely_accessed': 0,  # < 3 times
                'frequently_accessed': 0,  # >= 10 times
                'total_accesses': 0
            }
            
            access_counts = []
            
            for metadata in all_data['metadatas']:
                access_count = metadata.get('access_count', 0)
                access_counts.append(access_count)
                access_stats['total_accesses'] += access_count
                
                if access_count == 0:
                    access_stats['never_accessed'] += 1
                elif access_count < 3:
                    access_stats['rarely_accessed'] += 1
                elif access_count >= 10:
                    access_stats['frequently_accessed'] += 1
            
            if not access_counts:
                return {'status': 'unknown', 'message': 'No access data'}
            
            # Calculate access statistics
            total_memories = len(access_counts)
            never_accessed_ratio = access_stats['never_accessed'] / total_memories
            
            # Identify potential issues
            if never_accessed_ratio > 0.7:
                self.issues.append(HealthIssue(
                    severity='info',
                    category='performance',
                    issue='Many memories never accessed',
                    details={
                        'never_accessed_ratio': never_accessed_ratio,
                        'never_accessed_count': access_stats['never_accessed']
                    },
                    recommendation='Consider more aggressive decay for unaccessed memories',
                    timestamp=datetime.now()
                ))
            
            # Find most accessed memories (for insights)
            if access_counts:
                top_indices = np.argsort(access_counts)[-5:]
                top_accesses = [access_counts[i] for i in top_indices]
            else:
                top_accesses = []
            
            return {
                'status': 'info' if never_accessed_ratio > 0.7 else 'ok',
                **access_stats,
                'never_accessed_ratio': never_accessed_ratio,
                'avg_access_count': np.mean(access_counts) if access_counts else 0,
                'top_access_counts': top_accesses
            }
            
        except Exception as e:
            logger.error(f"Error checking access patterns: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def _calculate_emotional_trend(self, timeline: List[Dict]) -> str:
        """
        Calculate emotional trend from timeline
        """
        if len(timeline) < 2:
            return 'stable'
        
        # Get recent valence values
        recent = timeline[-20:]  # Last 20 entries
        valences = [e['valence'] for e in recent]
        
        # Fit linear trend
        x = range(len(valences))
        trend = np.polyfit(x, valences, 1)[0]
        
        if abs(trend) < 0.01:
            return 'stable'
        elif trend > 0.01:
            return 'positive'
        else:
            return 'negative'
    
    def generate_health_report(self, check_results: List[Dict]) -> Dict:
        """
        Generate comprehensive health report
        """
        # Count issues by severity
        severity_counts = Counter(issue.severity for issue in self.issues)
        
        # Overall health score (0-100)
        health_score = 100
        health_score -= severity_counts['critical'] * 20
        health_score -= severity_counts['warning'] * 10
        health_score -= severity_counts['info'] * 2
        health_score = max(0, health_score)
        
        # Determine overall status
        if severity_counts['critical'] > 0:
            overall_status = 'critical'
        elif severity_counts['warning'] > 2:
            overall_status = 'warning'
        elif health_score < 70:
            overall_status = 'degraded'
        else:
            overall_status = 'healthy'
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'environment': self.environment,
            'overall_status': overall_status,
            'health_score': health_score,
            'issue_summary': dict(severity_counts),
            'total_issues': len(self.issues),
            'check_results': {
                'fragmentation': check_results[0],
                'emotional_drift': check_results[1],
                'performance': check_results[2],
                'data_integrity': check_results[3],
                'duplicates': check_results[4],
                'retention': check_results[5],
                'growth': check_results[6],
                'resources': check_results[7],
                'relationship': check_results[8],
                'access_patterns': check_results[9]
            },
            'critical_issues': [
                {
                    'issue': issue.issue,
                    'details': issue.details,
                    'recommendation': issue.recommendation
                }
                for issue in self.issues if issue.severity == 'critical'
            ],
            'warnings': [
                {
                    'issue': issue.issue,
                    'details': issue.details,
                    'recommendation': issue.recommendation
                }
                for issue in self.issues if issue.severity == 'warning'
            ],
            'recommendations': self._generate_recommendations()
        }
        
        return report
    
    def _generate_recommendations(self) -> List[str]:
        """
        Generate actionable recommendations based on issues
        """
        recommendations = []
        
        # Group issues by category
        category_issues = defaultdict(list)
        for issue in self.issues:
            category_issues[issue.category].append(issue)
        
        # Performance recommendations
        if 'performance' in category_issues:
            recommendations.append(
                "Performance issues detected. Consider:\n"
                "- Implementing query result caching\n"
                "- Optimizing embedding dimensions\n"
                "- Adding read replicas for scaling"
            )
        
        # Integrity recommendations
        if 'integrity' in category_issues:
            recommendations.append(
                "Data integrity issues found. Actions needed:\n"
                "- Run data repair tool immediately\n"
                "- Implement stricter validation on memory creation\n"
                "- Set up automated integrity checks"
            )
        
        # Capacity recommendations
        if 'capacity' in category_issues:
            recommendations.append(
                "Capacity concerns detected. Consider:\n"
                "- Running deduplication process\n"
                "- Adjusting decay parameters\n"
                "- Implementing tiered storage (hot/warm/cold)"
            )
        
        # Drift recommendations
        if 'drift' in category_issues:
            recommendations.append(
                "Drift patterns observed. Recommended:\n"
                "- Review and adjust baseline parameters\n"
                "- Implement drift correction algorithms\n"
                "- Monitor phase transition patterns"
            )
        
        # General recommendations
        if not recommendations:
            recommendations.append(
                "System is healthy. Continue monitoring and:\n"
                "- Schedule regular health checks\n"
                "- Keep backups up to date\n"
                "- Review metrics weekly"
            )
        
        return recommendations
    
    def save_health_report(self, report: Dict):
        """
        Save health report to file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.report_dir / f"health_report_{timestamp}.json"
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Health report saved to {report_file}")
        
        # Also save a summary for quick access
        summary_file = self.report_dir / "latest_health_summary.json"
        summary = {
            'timestamp': report['timestamp'],
            'overall_status': report['overall_status'],
            'health_score': report['health_score'],
            'critical_issues': len(report['critical_issues']),
            'warnings': len(report['warnings']),
            'top_recommendations': report['recommendations'][:3]
        }
        
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
    
    def create_visualizations(self, report: Dict):
        """
        Create visual health report
        """
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle(f'Memory System Health Report - {self.environment}', fontsize=16)
        
        # 1. Health Score Gauge
        ax = axes[0, 0]
        health_score = report['health_score']
        colors = ['red', 'orange', 'yellow', 'lightgreen', 'green']
        color = colors[min(int(health_score / 20), 4)]
        
        ax.pie([health_score, 100-health_score], colors=[color, 'lightgray'],
               startangle=90, counterclock=False)
        ax.text(0, 0, f'{health_score}', ha='center', va='center', fontsize=30, weight='bold')
        ax.set_title('Overall Health Score')
        
        # 2. Issue Distribution
        ax = axes[0, 1]
        if report['issue_summary']:
            severities = list(report['issue_summary'].keys())
            counts = list(report['issue_summary'].values())
            colors_map = {'critical': 'red', 'warning': 'orange', 'info': 'blue'}
            colors = [colors_map.get(s, 'gray') for s in severities]
            ax.bar(severities, counts, color=colors)
            ax.set_title('Issues by Severity')
            ax.set_ylabel('Count')
        else:
            ax.text(0.5, 0.5, 'No Issues', ha='center', va='center')
            ax.set_title('Issues by Severity')
        
        # 3. Memory Growth Trend
        ax = axes[1, 0]
        if 'growth' in report['check_results'] and 'avg_daily_growth' in report['check_results']['growth']:
            growth_data = report['check_results']['growth']
            days = range(7)
            trend = [growth_data['avg_daily_growth'] + growth_data['growth_trend'] * (i-3) for i in days]
            ax.plot(days, trend, 'b-', linewidth=2)
            ax.axhline(y=growth_data['avg_daily_growth'], color='r', linestyle='--', 
                      label=f"Avg: {growth_data['avg_daily_growth']:.1f}")
            ax.set_title('Memory Growth Trend (7 days)')
            ax.set_xlabel('Days')
            ax.set_ylabel('Memories/Day')
            ax.legend()
        else:
            ax.text(0.5, 0.5, 'No Growth Data', ha='center', va='center')
            ax.set_title('Memory Growth Trend')
        
        # 4. Resource Usage
        ax = axes[1, 1]
        if 'resources' in report['check_results']:
            resources = report['check_results']['resources']
            resource_names = ['CPU', 'Memory', 'Disk']
            resource_values = [
                resources.get('cpu_percent', 0),
                resources.get('memory_percent', 0),
                resources.get('disk_percent', 0)
            ]
            
            bars = ax.bar(resource_names, resource_values)
            
            # Color bars based on usage
            for i, (name, value) in enumerate(zip(resource_names, resource_values)):
                if value > 85:
                    bars[i].set_color('red')
                elif value > 70:
                    bars[i].set_color('orange')
                else:
                    bars[i].set_color('green')
            
            ax.set_title('Resource Usage %')
            ax.set_ylim(0, 100)
            
            # Add value labels
            for bar, value in zip(bars, resource_values):
                ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                       f'{value:.1f}%', ha='center', va='bottom')
        else:
            ax.text(0.5, 0.5, 'No Resource Data', ha='center', va='center')
            ax.set_title('Resource Usage')
        
        plt.tight_layout()
        
        # Save visualization
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        viz_file = self.report_dir / f"health_visualization_{timestamp}.png"
        plt.savefig(viz_file, dpi=150, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Visualization saved to {viz_file}")


# Automated health monitoring service
class HealthMonitoringService:
    """
    Background service for continuous health monitoring
    """
    
    def __init__(self, environment: str = "production", check_interval_minutes: int = 60):
        self.monitor = MemoryHealthMonitor(environment)
        self.check_interval = timedelta(minutes=check_interval_minutes)
        self.running = False
        
    async def start(self):
        """
        Start continuous monitoring
        """
        self.running = True
        logger.info("Health monitoring service started")
        
        while self.running:
            try:
                # Run health check
                report = await self.monitor.run_comprehensive_health_check()
                
                # Create visualizations
                self.monitor.create_visualizations(report)
                
                # Log summary
                logger.info(
                    f"Health check complete - Status: {report['overall_status']}, "
                    f"Score: {report['health_score']}, "
                    f"Issues: {report['total_issues']}"
                )
                
                # Alert on critical issues
                if report['critical_issues']:
                    logger.critical(f"CRITICAL ISSUES DETECTED: {len(report['critical_issues'])}")
                    for issue in report['critical_issues']:
                        logger.critical(f"- {issue['issue']}: {issue['recommendation']}")
                
                # Wait for next check
                await asyncio.sleep(self.check_interval.total_seconds())
                
            except Exception as e:
                logger.error(f"Error in health monitoring: {e}")
                await asyncio.sleep(60)  # Wait a minute before retrying
    
    def stop(self):
        """
        Stop monitoring service
        """
        self.running = False
        logger.info("Health monitoring service stopped")


# CLI interface
async def main():
    """
    CLI for health monitoring
    """
    import argparse
    
    parser = argparse.ArgumentParser(description='Memory System Health Monitor')
    parser.add_argument('--environment', default='production', 
                       choices=['production', 'canary', 'test'],
                       help='Environment to monitor')
    parser.add_argument('--continuous', action='store_true',
                       help='Run continuous monitoring')
    parser.add_argument('--interval', type=int, default=60,
                       help='Check interval in minutes (for continuous mode)')
    
    args = parser.parse_args()
    
    if args.continuous:
        # Run as service
        service = HealthMonitoringService(args.environment, args.interval)
        try:
            await service.start()
        except KeyboardInterrupt:
            service.stop()
    else:
        # Run single check
        monitor = MemoryHealthMonitor(args.environment)
        report = await monitor.run_comprehensive_health_check()
        monitor.create_visualizations(report)
        
        # Print summary
        print(f"\n{'='*50}")
        print(f"Memory System Health Report - {args.environment}")
        print(f"{'='*50}")
        print(f"Overall Status: {report['overall_status']}")
        print(f"Health Score: {report['health_score']}/100")
        print(f"Critical Issues: {len(report['critical_issues'])}")
        print(f"Warnings: {len(report['warnings'])}")
        print(f"\nTop Recommendations:")
        for rec in report['recommendations'][:3]:
            print(f"- {rec}")
        print(f"\nFull report saved to: health_reports_{args.environment}/")


if __name__ == "__main__":
    asyncio.run(main())