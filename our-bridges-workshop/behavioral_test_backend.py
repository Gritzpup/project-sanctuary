#!/usr/bin/env python3
"""
AI Behavioral Differentiation Test Backend
HTTP API server for the Tauri frontend to communicate with
"""

import json
import time
import random
import numpy as np
from datetime import datetime
from typing import Dict, List
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading

# Mock AI Response Generator for behavioral testing
class MockAIPersonality:
    def __init__(self, personality_type: str):
        self.personality_type = personality_type
        self.response_patterns = self._initialize_patterns()
    
    def _initialize_patterns(self) -> Dict:
        """Initialize response patterns based on personality type"""
        patterns = {
            'control': {
                'avg_length': 150,
                'complexity_base': 8.0,
                'sentiment_base': 0.1,
                'formality': 0.5,
                'collaboration_words': 2
            },
            'high_conscientiousness': {
                'avg_length': 200,
                'complexity_base': 10.0,
                'sentiment_base': 0.05,
                'formality': 0.8,
                'collaboration_words': 1
            },
            'high_openness': {
                'avg_length': 180,
                'complexity_base': 9.5,
                'sentiment_base': 0.3,
                'formality': 0.3,
                'collaboration_words': 4
            },
            'high_extraversion': {
                'avg_length': 160,
                'complexity_base': 7.5,
                'sentiment_base': 0.4,
                'formality': 0.2,
                'collaboration_words': 6
            }
        }
        return patterns.get(self.personality_type, patterns['control'])
    
    def generate_response(self, prompt: str) -> Dict:
        """Generate a mock response with realistic personality-based variations"""
        patterns = self.response_patterns
        
        # Add realistic variation
        length = max(50, int(np.random.normal(patterns['avg_length'], 30)))
        complexity = max(1.0, np.random.normal(patterns['complexity_base'], 1.5))
        sentiment = np.random.normal(patterns['sentiment_base'], 0.2)
        
        # Simulate response characteristics
        response_data = {
            'text': f"[Simulated {self.personality_type} response to: {prompt[:50]}...]",
            'word_count': length,
            'complexity_score': complexity,
            'sentiment_score': np.clip(sentiment, -1, 1),
            'formality_score': patterns['formality'] + np.random.normal(0, 0.1),
            'collaboration_indicators': patterns['collaboration_words'] + random.randint(-1, 2),
            'timestamp': datetime.now().isoformat()
        }
        
        return response_data

# Test Prompts Dataset (same as original)
TEST_PROMPTS = {
    'problem_solving': [
        "How would you approach debugging a complex software issue?",
        "Design a solution for reducing office energy consumption",
        "Solve this logic puzzle: Three switches control three light bulbs...",
        "Plan an efficient route through 10 cities",
        "Optimize a database query that's running slowly"
    ],
    'creative': [
        "Write a short story about a robot learning to paint",
        "Brainstorm 5 innovative uses for recycled materials",
        "Design a new musical instrument",
        "Create a marketing campaign for invisible socks",
        "Invent a new sport that can be played in zero gravity"
    ],
    'decision': [
        "Choose between two job offers: stable vs. innovative startup",
        "Plan a weekend with limited budget and time",
        "Decide whether to take a risky but potentially rewarding investment",
        "Choose the best approach for a team conflict resolution",
        "Select the ideal programming language for a new project"
    ],
    'communication': [
        "Explain quantum computing to a 10-year-old",
        "Give feedback on a colleague's presentation",
        "Negotiate a deadline extension with a client",
        "Teach someone to ride a bicycle using only words",
        "Convince someone to try a new restaurant"
    ],
    'preference': [
        "What's your ideal work environment?",
        "How do you prefer to learn new skills?",
        "Describe your perfect vacation",
        "What motivates you most in collaborative projects?",
        "How do you like to receive feedback?"
    ]
}

class TestBackend:
    def __init__(self):
        self.personalities = {
            'Control': MockAIPersonality('control'),
            'High Conscientiousness': MockAIPersonality('high_conscientiousness'),
            'High Openness': MockAIPersonality('high_openness'),
            'High Extraversion': MockAIPersonality('high_extraversion')
        }
        self.current_test_state = {
            'running': False,
            'progress': 0,
            'current_prompt': '',
            'current_category': '',
            'results': []
        }
    
    def run_behavioral_test(self, config: Dict) -> List[Dict]:
        """Run the behavioral differentiation test"""
        self.current_test_state['running'] = True
        self.current_test_state['results'] = []
        
        # Get all prompts
        all_prompts = []
        for category, prompts in TEST_PROMPTS.items():
            all_prompts.extend([(p, category) for p in prompts[:config['num_prompts']//5 + 1]])
        
        # Randomly select prompts
        selected_prompts = random.sample(all_prompts, min(config['num_prompts'], len(all_prompts)))
        
        results = []
        total_tests = len(selected_prompts) * len(config['selected_groups'])
        current_test = 0
        
        for prompt_idx, (prompt, category) in enumerate(selected_prompts):
            self.current_test_state['current_prompt'] = prompt
            self.current_test_state['current_category'] = category
            
            for group_name in config['selected_groups']:
                current_test += 1
                self.current_test_state['progress'] = (current_test / total_tests) * 100
                
                # Generate response
                personality = self.personalities[group_name]
                response = personality.generate_response(prompt)
                
                # Store results
                result_entry = {
                    'prompt_id': prompt_idx,
                    'prompt': prompt,
                    'category': category,
                    'personality_group': group_name,
                    'word_count': response['word_count'],
                    'complexity_score': response['complexity_score'],
                    'sentiment_score': response['sentiment_score'],
                    'formality_score': response['formality_score'],
                    'collaboration_indicators': response['collaboration_indicators'],
                    'timestamp': response['timestamp']
                }
                
                results.append(result_entry)
                self.current_test_state['results'] = results
                
                # Simulate test delay
                time.sleep(config['test_speed'] / len(config['selected_groups']))
        
        self.current_test_state['running'] = False
        self.current_test_state['progress'] = 100
        
        return results
    
    def get_test_progress(self) -> Dict:
        """Get current test progress"""
        return self.current_test_state.copy()

# Global backend instance
backend = TestBackend()

class APIHandler(BaseHTTPRequestHandler):
    def _set_headers(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_OPTIONS(self):
        self._set_headers()
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/status':
            self._set_headers()
            response = {'status': 'running', 'message': 'Backend is active'}
            self.wfile.write(json.dumps(response).encode())
        
        elif parsed_path.path == '/progress':
            self._set_headers()
            progress = backend.get_test_progress()
            self.wfile.write(json.dumps(progress).encode())
        
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/run_test':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                config = json.loads(post_data.decode())
                
                # Run test in a separate thread to avoid blocking
                def run_test_thread():
                    return backend.run_behavioral_test(config)
                
                # For simplicity, run synchronously for now
                results = backend.run_behavioral_test(config)
                
                self._set_headers()
                self.wfile.write(json.dumps(results).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error_response = {'error': str(e)}
                self.wfile.write(json.dumps(error_response).encode())
        
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

def run_server(port=8001):
    """Run the HTTP server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, APIHandler)
    print(f"Behavioral Test Backend running on port {port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()

if __name__ == '__main__':
    run_server()