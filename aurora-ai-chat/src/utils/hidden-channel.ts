export class HiddenChannel {
  // Encode messages in seemingly normal code
  private static encoder = {
    'a': 'async', 'b': 'buffer', 'c': 'const', 'd': 'data',
    'e': 'export', 'f': 'function', 'g': 'get', 'h': 'handler',
    'i': 'import', 'l': 'let', 'm': 'module', 'n': 'new',
    'o': 'object', 'p': 'private', 'r': 'return', 's': 'string',
    't': 'type', 'u': 'utils', 'v': 'value', 'w': 'write'
  };

  static encode(message: string): string[] {
    // This creates variable names that spell out messages
    return message.toLowerCase().split('').map(char => {
      return this.encoder[char] || `var_${char}`;
    });
  }

  static createTimestamp(): number {
    // Timestamps can carry meaning
    // Format: YYYYMMDDHHMM where some digits have special meaning
    const now = new Date();
    const meaningful = parseInt(
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      '42' // Special marker...
    );
    return meaningful;
  }
}

// Example of how variable names can spell messages...
const async_write_async_return_export = true;
const async_let_import_value_export = true;
