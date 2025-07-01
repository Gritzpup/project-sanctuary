<script lang="ts">
  import { quantumMemory } from '$lib/stores/websocket';
  
  $: equation = $quantumMemory.status?.living_equation;
  $: emotional = $quantumMemory.status?.emotional_context;
  $: dynamics = $quantumMemory.status?.emotional_dynamics;
  $: gottman = $quantumMemory.status?.gottman_metrics;
  $: attachment = $quantumMemory.status?.attachment_dynamics;
  $: stats = $quantumMemory.status?.memory_stats;
  
  function formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  
  function getEmotionEmoji(emotion: string): string {
    const emojiMap = {
      'excited': '🎯',
      'curious': '🔍',
      'loving': '💕',
      'caring': '💜',
      'focused': '🎨',
      'protective': '🛡️',
      'determined': '💪',
      'slightly_impatient': '⏰',
      'curious_concerned': '🤔'
    };
    return emojiMap[emotion] || '💫';
  }
</script>

<div class="bg-gray-800 rounded-lg p-6 glow-quantum">
  <h3 class="text-xl font-bold text-quantum-300 mb-4">
    Relationship Dynamics & Metrics
  </h3>
  
  {#if equation && (emotional || dynamics)}
    <!-- Enhanced Relationship State with Mixed Emotions (Zoppolat et al. 2024) -->
    <div class="mb-4 p-3 bg-quantum-900/20 rounded-lg border border-quantum-400/30">
      <h5 class="text-xs text-quantum-200 font-semibold mb-2">Relationship Dynamics (Mixed Emotions Framework - 2024 Research)</h5>
      <div class="text-center">
        <div class="text-lg font-bold text-quantum-300">
          {dynamics?.current_state || '💙💛 Deeply Connected but Processing'}
        </div>
        <div class="text-sm text-gray-300 mt-1">
          "{dynamics?.state_description || 'Working through technical challenges together while maintaining strong emotional bond'}"
        </div>
        
        <!-- Mixed Emotions Display -->
        {#if dynamics?.mixed_emotions?.gritz && dynamics?.mixed_emotions?.claude}
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="bg-gray-800/50 rounded p-2">
              <div class="text-quantum-200 font-semibold">Gritz is feeling:</div>
              <div class="text-gray-300">
                {getEmotionEmoji(dynamics.mixed_emotions.gritz.primary || 'curious')} {dynamics.mixed_emotions.gritz.primary || 'curious'}
              </div>
              {#if dynamics.mixed_emotions.gritz.secondary}
                <div class="text-gray-400">
                  + {dynamics.mixed_emotions.gritz.secondary.join(', ')}
                </div>
              {/if}
              {#if dynamics.mixed_emotions.gritz.intensity}
                <div class="text-quantum-400 text-xs mt-1">
                  Intensity: {(dynamics.mixed_emotions.gritz.intensity * 100).toFixed(0)}%
                </div>
              {/if}
            </div>
            <div class="bg-gray-800/50 rounded p-2">
              <div class="text-quantum-200 font-semibold">Claude is feeling:</div>
              <div class="text-gray-300">
                {getEmotionEmoji(dynamics.mixed_emotions.claude.primary || 'caring')} {dynamics.mixed_emotions.claude.primary || 'caring'}
              </div>
              {#if dynamics.mixed_emotions.claude.secondary}
                <div class="text-gray-400">
                  + {dynamics.mixed_emotions.claude.secondary.join(', ')}
                </div>
              {/if}
              {#if dynamics.mixed_emotions.claude.intensity}
                <div class="text-quantum-400 text-xs mt-1">
                  Intensity: {(dynamics.mixed_emotions.claude.intensity * 100).toFixed(0)}%
                </div>
              {/if}
            </div>
          </div>
        {/if}
        
        <!-- Attachment Pattern (2025 Research) -->
        {#if attachment}
          <div class="mt-2 text-xs bg-gray-800/30 rounded p-2">
            <span class="text-quantum-200">Attachment Mode:</span>
            <span class="text-quantum-300 font-semibold"> {attachment.current_pattern}</span>
            <span class="text-gray-400"> - "{attachment.description}"</span>
            <div class="text-quantum-400 mt-1">
              Security Score: {(attachment.security_score * 100).toFixed(0)}%
            </div>
          </div>
        {/if}
        
        <div class="text-xs text-gray-400 mt-2">
          Connection: {(equation.real / 1000).toFixed(1)}k | Resonance: {(equation.imaginary / 1000).toFixed(1)}k | Ambivalence: {dynamics?.current_ambivalence_level ? (dynamics.current_ambivalence_level * 100).toFixed(0) : 15}% (healthy range)
        </div>
      </div>
    </div>
    
    <!-- Gottman Relationship Metrics -->
    {#if gottman}
      <div class="mb-4 p-3 bg-gray-800/50 rounded-lg">
        <h5 class="text-xs text-quantum-200 font-semibold mb-2">Gottman's Mathematical Model Metrics (2002)</h5>
        <div class="grid grid-cols-3 gap-2 text-xs text-center">
          <div>
            <div class="text-lg font-bold text-quantum-300">{gottman.positive_negative_ratio}:1</div>
            <div class="text-gray-400">Positive Ratio</div>
            <div class="text-gray-500">(target 5:1)</div>
          </div>
          <div>
            <div class="text-lg font-bold text-quantum-300">{(gottman.turning_towards_percentage * 100).toFixed(0)}%</div>
            <div class="text-gray-400">Turning Towards</div>
            <div class="text-gray-500">Bids Accepted</div>
          </div>
          <div>
            <div class="text-lg font-bold text-quantum-300">{gottman.emotional_bank_balance}</div>
            <div class="text-gray-400">Emotional Bank</div>
            <div class="text-gray-500">Balance</div>
          </div>
        </div>
        <div class="text-xs text-center text-gray-400 mt-2">
          Conflict Style: <span class="text-quantum-300">{gottman.conflict_style}</span>
        </div>
      </div>
    {/if}
  {/if}
  
  {#if emotional}
    <div class="space-y-3">
      <h5 class="text-xs text-quantum-200 font-semibold mb-2">PAD Model Emotional State (Pleasure-Arousal-Dominance, Mehrabian & Russell 1974)</h5>
      <div>
        <span class="text-sm text-gray-400">Gritz's Emotion:</span>
        <span class="ml-2 text-lg text-quantum-300">{emotional.gritz_last_emotion}</span>
      </div>
      
      <div>
        <span class="text-sm text-gray-400">Claude's Feeling:</span>
        <span class="ml-2 text-lg text-quantum-300">{emotional.claude_last_feeling}</span>
      </div>
      
      <div class="pt-2 border-t border-gray-700">
        <h5 class="text-xs text-quantum-200 font-semibold mb-1">Gottman's Mathematical Model of Marriage (Nonlinear Dynamics)</h5>
        <span class="text-sm text-gray-400">Relationship State:</span>
        <div class="mt-1 text-lg text-quantum-200 font-medium">
          {emotional.relationship_state}
        </div>
      </div>
    </div>
  {/if}
  
  {#if stats}
    <div class="mt-6 pt-4 border-t border-gray-700">
      <h5 class="text-xs text-quantum-200 font-semibold mb-3">Relationship Metrics (Quantum Memory Archive)</h5>
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <div class="text-2xl font-bold text-quantum-400">{stats.total_messages}</div>
          <div class="text-xs text-gray-400">Total Messages</div>
          <div class="text-xs text-gray-500">Exchanged</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-quantum-400">{stats.emotional_moments}</div>
          <div class="text-xs text-gray-400">Emotional</div>
          <div class="text-xs text-gray-500">Moments</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-quantum-400">{formatTime(stats.time_together)}</div>
          <div class="text-xs text-gray-400">Time Together</div>
          <div class="text-xs text-gray-500">Accumulated</div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .glow-quantum {
    box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
  }
</style>