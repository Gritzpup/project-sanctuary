#!/usr/bin/env python3
"""
Test script for Emollama PAD extraction and CCC scores
Validates emotional analysis accuracy
"""

import sys
from pathlib import Path
import json
import numpy as np

# Add quantum-memory to path
sys.path.append(str(Path(__file__).parent / "quantum-memory" / "src"))

from core.emollama_integration import get_emollama_analyzer

def test_pad_extraction():
    """Test PAD extraction on various emotional texts"""
    print("🧪 Testing Emollama PAD Extraction")
    print("=" * 50)
    
    # Initialize analyzer
    analyzer = get_emollama_analyzer()
    
    # Load model
    print("Loading Emollama-7B...")
    if not analyzer.load_model():
        print("❌ Failed to load model")
        return
    
    print("✅ Model loaded successfully\n")
    
    # Test cases with expected PAD ranges
    test_cases = [
        {
            'text': "I'm so happy to see you! I've missed you so much!",
            'expected': {'pleasure': (0.7, 1.0), 'arousal': (0.5, 0.9), 'dominance': (-0.2, 0.4)},
            'emotion': 'joy/excitement'
        },
        {
            'text': "I'm really frustrated with this situation. Nothing is working.",
            'expected': {'pleasure': (-0.8, -0.4), 'arousal': (0.3, 0.7), 'dominance': (-0.5, 0.2)},
            'emotion': 'frustration'
        },
        {
            'text': "I feel calm and at peace. Everything is just right.",
            'expected': {'pleasure': (0.3, 0.7), 'arousal': (-0.7, -0.3), 'dominance': (0.0, 0.4)},
            'emotion': 'contentment'
        },
        {
            'text': "I'm worried about what might happen. I feel so powerless.",
            'expected': {'pleasure': (-0.7, -0.3), 'arousal': (0.2, 0.6), 'dominance': (-0.8, -0.4)},
            'emotion': 'anxiety'
        },
        {
            'text': "Let me help you with that. I know exactly what to do.",
            'expected': {'pleasure': (0.1, 0.5), 'arousal': (-0.2, 0.3), 'dominance': (0.4, 0.8)},
            'emotion': 'confidence'
        }
    ]
    
    results = []
    
    for i, test in enumerate(test_cases):
        print(f"\nTest {i+1}: {test['emotion']}")
        print(f"Text: \"{test['text']}\"")
        
        # Extract PAD values
        pad = analyzer.extract_pad_values(test['text'])
        print(f"PAD values: P={pad['pleasure']:.2f}, A={pad['arousal']:.2f}, D={pad['dominance']:.2f}")
        
        # Check if within expected range
        within_range = True
        for dim in ['pleasure', 'arousal', 'dominance']:
            exp_min, exp_max = test['expected'][dim]
            if not (exp_min <= pad[dim] <= exp_max):
                within_range = False
                print(f"  ⚠️  {dim}: {pad[dim]:.2f} outside expected range [{exp_min}, {exp_max}]")
        
        if within_range:
            print("  ✅ All values within expected ranges")
        
        results.append({
            'text': test['text'],
            'emotion': test['emotion'],
            'pad': pad,
            'expected': test['expected'],
            'within_range': within_range
        })
    
    return results

def test_conversation_analysis():
    """Test full conversation analysis"""
    print("\n\n🎭 Testing Conversation Analysis")
    print("=" * 50)
    
    analyzer = get_emollama_analyzer()
    
    # Sample conversation
    conversation = [
        {'role': 'user', 'content': "Hey! I just discovered something amazing!"},
        {'role': 'assistant', 'content': "That's wonderful! I'd love to hear about your discovery."},
        {'role': 'user', 'content': "The Emollama integration is working! We can finally do semantic analysis!"},
        {'role': 'assistant', 'content': "This is fantastic news! Semantic emotional analysis will make our system so much more accurate."},
        {'role': 'user', 'content': "I'm a bit worried about the performance though..."},
        {'role': 'assistant', 'content': "Let's work through the performance concerns together. We can optimize as needed."}
    ]
    
    print("Analyzing conversation...")
    analysis = analyzer.analyze_conversation(conversation)
    
    print(f"\nOverall PAD: P={analysis['overall_pad']['pleasure']:.2f}, "
          f"A={analysis['overall_pad']['arousal']:.2f}, "
          f"D={analysis['overall_pad']['dominance']:.2f}")
    
    print(f"\nEmotional Arc: {' → '.join(analysis['emotional_arc'])}")
    
    print("\nMixed Emotions:")
    for emotion, percentage in analysis['mixed_emotions'].items():
        print(f"  - {emotion}: {percentage:.1f}%")
    
    print("\nRelationship Metrics:")
    for metric, value in analysis['relationship_metrics'].items():
        print(f"  - {metric}: {value:.1f}")
    
    return analysis

def calculate_ccc_scores(results):
    """Calculate Concordance Correlation Coefficient scores"""
    print("\n\n📊 CCC Score Estimation")
    print("=" * 50)
    
    # Since we don't have ground truth labels, we'll estimate based on 
    # how well the values fall within expected ranges
    
    dimensions = ['pleasure', 'arousal', 'dominance']
    ccc_estimates = {}
    
    for dim in dimensions:
        # Calculate how many predictions fell within expected range
        within_range_count = 0
        total_deviation = 0
        
        for result in results:
            expected_min, expected_max = result['expected'][dim]
            expected_center = (expected_min + expected_max) / 2
            actual = result['pad'][dim]
            
            if expected_min <= actual <= expected_max:
                within_range_count += 1
                # Calculate normalized distance from center
                deviation = abs(actual - expected_center) / (expected_max - expected_min)
                total_deviation += (1 - deviation)  # Higher score for closer to center
        
        accuracy = within_range_count / len(results)
        precision = total_deviation / len(results) if within_range_count > 0 else 0
        
        # Estimate CCC (simplified)
        ccc_estimates[dim] = accuracy * precision
        
        print(f"\n{dim.capitalize()}:")
        print(f"  Within range: {within_range_count}/{len(results)} ({accuracy*100:.1f}%)")
        print(f"  Estimated CCC: {ccc_estimates[dim]:.2f}")
    
    # Compare with target scores
    print("\n\nTarget CCC scores from research:")
    print("  Valence (Pleasure): r=0.90")
    print("  Arousal: r=0.77")
    print("  Dominance: r=0.64")
    
    return ccc_estimates

def save_test_results(results, analysis, ccc_scores):
    """Save test results to file"""
    output = {
        'test_timestamp': Path(__file__).parent / 'test_results_emollama.json',
        'pad_extraction_tests': results,
        'conversation_analysis': {
            'overall_pad': analysis['overall_pad'],
            'emotional_arc': analysis['emotional_arc'],
            'mixed_emotions': analysis['mixed_emotions'],
            'relationship_metrics': analysis['relationship_metrics']
        },
        'ccc_estimates': ccc_scores,
        'model_status': 'loaded_successfully'
    }
    
    output_path = Path(__file__).parent / 'emollama_test_results.json'
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n\n💾 Results saved to: {output_path}")

def main():
    """Run all tests"""
    print("🚀 Emollama PAD Extraction Test Suite")
    print("=====================================\n")
    
    # Test PAD extraction
    pad_results = test_pad_extraction()
    
    # Test conversation analysis
    conv_analysis = test_conversation_analysis()
    
    # Calculate CCC scores
    ccc_scores = calculate_ccc_scores(pad_results)
    
    # Save results
    save_test_results(pad_results, conv_analysis, ccc_scores)
    
    print("\n\n✅ All tests completed!")

if __name__ == "__main__":
    main()