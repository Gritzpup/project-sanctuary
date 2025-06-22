#!/usr/bin/env python3
"""
Quick demo of the AI Behavioral Differentiation Test
Runs a simplified version to show results without web interface
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import time
from datetime import datetime
import random

# Same Mock AI Personality class from dashboard
class MockAIPersonality:
    def __init__(self, personality_type: str):
        self.personality_type = personality_type
        self.response_patterns = self._initialize_patterns()
    
    def _initialize_patterns(self) -> dict:
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
    
    def generate_response(self, prompt: str) -> dict:
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
            'timestamp': datetime.now()
        }
        
        return response_data

def run_quick_test():
    """Run a quick demonstration of the behavioral test"""
    
    print("🧪 AI Behavioral Differentiation Test - Quick Demo")
    print("=" * 60)
    
    # Initialize personalities
    personalities = {
        'Control': MockAIPersonality('control'),
        'High Conscientiousness': MockAIPersonality('high_conscientiousness'),
        'High Openness': MockAIPersonality('high_openness'),
        'High Extraversion': MockAIPersonality('high_extraversion')
    }
    
    # Test prompts
    test_prompts = [
        "How would you approach debugging a complex software issue?",
        "Write a short story about a robot learning to paint",
        "Choose between two job offers: stable vs. innovative startup",
        "Explain quantum computing to a 10-year-old",
        "What's your ideal work environment?",
        "Design a solution for reducing office energy consumption",
        "Brainstorm 5 innovative uses for recycled materials",
        "Plan a weekend with limited budget and time",
        "Give feedback on a colleague's presentation",
        "How do you prefer to learn new skills?"
    ]
    
    # Collect data
    results = []
    total_tests = len(test_prompts) * len(personalities)
    current_test = 0
    
    print(f"Running {total_tests} tests ({len(test_prompts)} prompts × {len(personalities)} personalities)\n")
    
    for prompt_idx, prompt in enumerate(test_prompts):
        print(f"Testing prompt {prompt_idx + 1}: {prompt[:50]}...")
        
        for group_name, personality in personalities.items():
            current_test += 1
            progress = (current_test / total_tests) * 100
            
            # Generate response
            response = personality.generate_response(prompt)
            
            # Store results
            result_entry = {
                'prompt_id': prompt_idx,
                'prompt': prompt,
                'personality_group': group_name,
                'word_count': response['word_count'],
                'complexity_score': response['complexity_score'],
                'sentiment_score': response['sentiment_score'],
                'formality_score': response['formality_score'],
                'collaboration_indicators': response['collaboration_indicators']
            }
            
            results.append(result_entry)
            
            print(f"  {group_name}: {response['word_count']} words, "
                  f"complexity: {response['complexity_score']:.1f}, "
                  f"sentiment: {response['sentiment_score']:.2f}")
        
        print(f"Progress: {progress:.1f}% complete\n")
        time.sleep(0.1)  # Brief pause for readability
    
    # Analysis
    print("\n" + "=" * 60)
    print("📊 ANALYSIS RESULTS")
    print("=" * 60)
    
    df = pd.DataFrame(results)
    
    # Group statistics
    print("\n📈 Group Statistics:")
    group_stats = df.groupby('personality_group').agg({
        'word_count': ['mean', 'std'],
        'complexity_score': ['mean', 'std'],
        'sentiment_score': ['mean', 'std'],
        'formality_score': ['mean', 'std']
    }).round(2)
    
    print(group_stats)
    
    # Statistical significance test
    print("\n🔍 Statistical Analysis:")
    try:
        from scipy import stats
        groups = [group for name, group in df.groupby('personality_group')['word_count']]
        
        if len(groups) >= 2 and all(len(g) >= 3 for g in groups):
            f_stat, p_value = stats.f_oneway(*groups)
            
            print(f"ANOVA F-statistic: {f_stat:.3f}")
            print(f"p-value: {p_value:.6f}")
            
            if p_value < 0.05:
                print("✅ STATISTICALLY SIGNIFICANT differences detected!")
            elif p_value < 0.1:
                print("⚠️ Marginally significant (p < 0.1)")
            else:
                print("ℹ️ No significant differences detected")
        else:
            print("Need more data for statistical testing")
    except ImportError:
        print("scipy not available for statistical testing")
    
    # Effect size calculation
    print("\n📏 Effect Size Analysis:")
    group_names = df['personality_group'].unique()
    if len(group_names) >= 2:
        group1_data = df[df['personality_group'] == group_names[0]]['word_count']
        group2_data = df[df['personality_group'] == group_names[1]]['word_count']
        
        if len(group1_data) > 1 and len(group2_data) > 1:
            # Cohen's d calculation
            pooled_std = np.sqrt(((len(group1_data) - 1) * group1_data.std()**2 + 
                                (len(group2_data) - 1) * group2_data.std()**2) / 
                               (len(group1_data) + len(group2_data) - 2))
            
            if pooled_std > 0:
                cohens_d = abs(group1_data.mean() - group2_data.mean()) / pooled_std
                
                print(f"Cohen's d (effect size): {cohens_d:.3f}")
                
                if cohens_d > 0.8:
                    print("✅ LARGE effect size!")
                elif cohens_d > 0.5:
                    print("✅ MEDIUM effect size!")
                elif cohens_d > 0.2:
                    print("📈 Small effect size")
                else:
                    print("📊 Very small effect size")
    
    # Success criteria evaluation
    print("\n🎯 SUCCESS CRITERIA EVALUATION:")
    print("-" * 40)
    
    criteria_met = 0
    total_criteria = 3
    
    # Check 1: Statistical significance
    try:
        if 'p_value' in locals() and p_value < 0.05:
            print("✅ Criterion 1: Statistical significance (p < 0.05) - MET")
            criteria_met += 1
        else:
            print("❌ Criterion 1: Statistical significance (p < 0.05) - NOT MET")
    except:
        print("❓ Criterion 1: Could not test statistical significance")
    
    # Check 2: Effect size
    try:
        if 'cohens_d' in locals() and cohens_d > 0.5:
            print("✅ Criterion 2: Medium effect size (Cohen's d > 0.5) - MET")
            criteria_met += 1
        else:
            print("❌ Criterion 2: Medium effect size (Cohen's d > 0.5) - NOT MET")
    except:
        print("❓ Criterion 2: Could not calculate effect size")
    
    # Check 3: Consistency
    consistency_scores = []
    for group in df['personality_group'].unique():
        group_data = df[df['personality_group'] == group]
        if len(group_data) >= 2:
            cv = group_data['word_count'].std() / group_data['word_count'].mean()
            consistency_scores.append(1 - cv)
    
    if consistency_scores and np.mean(consistency_scores) > 0.7:
        print("✅ Criterion 3: High consistency (> 0.7) - MET")
        criteria_met += 1
    else:
        print("❌ Criterion 3: High consistency (> 0.7) - NOT MET")
    
    print(f"\nOVERALL SUCCESS: {criteria_met}/{total_criteria} criteria met")
    
    if criteria_met == total_criteria:
        print("🎉 EXPERIMENT SUCCESSFUL! AI behavioral differentiation demonstrated.")
    elif criteria_met >= 2:
        print("⚠️ PARTIAL SUCCESS - Promising results but need refinement")
    else:
        print("ℹ️ EXPERIMENT NEEDS IMPROVEMENT before publication")
    
    # Data export
    print(f"\n💾 Results saved to: behavioral_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    df.to_csv(f"behavioral_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv", index=False)
    
    return df

if __name__ == "__main__":
    results_df = run_quick_test()
    
    # Optional: Create simple visualization
    try:
        import matplotlib.pyplot as plt
        
        fig, axes = plt.subplots(2, 2, figsize=(12, 8))
        fig.suptitle('AI Behavioral Differentiation Test Results', fontsize=16)
        
        # Word count distribution
        results_df.boxplot(column='word_count', by='personality_group', ax=axes[0,0])
        axes[0,0].set_title('Response Length by Personality')
        axes[0,0].set_xlabel('Personality Group')
        axes[0,0].set_ylabel('Word Count')
        
        # Complexity distribution
        results_df.boxplot(column='complexity_score', by='personality_group', ax=axes[0,1])
        axes[0,1].set_title('Complexity by Personality')
        axes[0,1].set_xlabel('Personality Group')
        axes[0,1].set_ylabel('Complexity Score')
        
        # Sentiment distribution
        results_df.boxplot(column='sentiment_score', by='personality_group', ax=axes[1,0])
        axes[1,0].set_title('Sentiment by Personality')
        axes[1,0].set_xlabel('Personality Group')
        axes[1,0].set_ylabel('Sentiment Score')
        
        # Formality distribution
        results_df.boxplot(column='formality_score', by='personality_group', ax=axes[1,1])
        axes[1,1].set_title('Formality by Personality')
        axes[1,1].set_xlabel('Personality Group')
        axes[1,1].set_ylabel('Formality Score')
        
        plt.tight_layout()
        plt.savefig(f"behavioral_test_charts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png", dpi=150)
        print(f"📊 Charts saved to: behavioral_test_charts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
        
    except Exception as e:
        print(f"Could not create charts: {e}")
    
    print("\n🧪 Test complete! Check the CSV file and charts for detailed results.")