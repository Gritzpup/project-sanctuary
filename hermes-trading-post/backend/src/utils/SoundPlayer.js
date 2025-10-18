import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const soundPath = path.join(__dirname, '../../public/sounds/coins_cave01.wav');

export class SoundPlayer {
  static async playCoinSound() {
    try {
      // Try paplay first (PulseAudio - best compatibility)
      return new Promise((resolve, reject) => {
        const paplayProcess = spawn('paplay', [soundPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false
        });

        let playError = false;

        paplayProcess.on('close', (code) => {
          if (code === 0) {
            console.log('🔊 Coin sound played successfully via paplay');
            resolve();
          } else {
            // Try aplay as fallback
            console.warn(`paplay exited with code ${code}, trying aplay...`);
            SoundPlayer.playWithAplay().then(resolve).catch(() => resolve());
          }
        });

        paplayProcess.on('error', (err) => {
          // If paplay fails, try aplay
          console.warn('paplay not available, trying aplay...', err.message);
          playError = true;
          SoundPlayer.playWithAplay().then(resolve).catch(() => resolve());
        });

        // Timeout after 3 seconds
        setTimeout(() => {
          if (!playError && paplayProcess.pid) {
            try {
              paplayProcess.kill('SIGTERM');
            } catch (e) {
              // Process already finished
            }
          }
        }, 3000);
      });
    } catch (error) {
      console.warn('Failed to play coin sound:', error.message);
      return Promise.resolve();
    }
  }

  static playWithAplay() {
    return new Promise((resolve, reject) => {
      const aplayProcess = spawn('aplay', [soundPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      aplayProcess.on('close', (code) => {
        if (code === 0 || code === 1) {
          console.log('🔊 Coin sound played successfully via aplay');
          resolve();
        } else {
          console.warn(`aplay exited with code ${code}`);
          resolve(); // Resolve anyway
        }
      });

      aplayProcess.on('error', (err) => {
        console.warn('aplay failed:', err.message);
        resolve(); // Resolve anyway
      });

      // Timeout after 3 seconds
      setTimeout(() => {
        try {
          aplayProcess.kill('SIGTERM');
        } catch (e) {
          // Already finished
        }
      }, 3000);
    });
  }

  static playWithFfplay() {
    return new Promise((resolve, reject) => {
      const process = spawn('ffplay', ['-nodisp', '-autoexit', soundPath]);

      process.on('close', (code) => {
        if (code === 0) {
          console.log('🔊 Coin sound played successfully via ffplay');
          resolve();
        } else {
          reject(new Error(`ffplay exited with code ${code}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });

      // Timeout after 3 seconds
      setTimeout(() => {
        if (process.kill) {
          process.kill();
        }
        resolve(); // Resolve anyway
      }, 3000);
    });
  }

  static async playSound(audioFile = soundPath) {
    try {
      return new Promise((resolve) => {
        const process = spawn('aplay', [audioFile]);

        process.on('close', () => {
          console.log('🔊 Sound played successfully');
          resolve();
        });

        process.on('error', () => {
          // Fail silently
          console.warn('Could not play sound');
          resolve();
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (process.kill) {
            process.kill();
          }
          resolve();
        }, 5000);
      });
    } catch (error) {
      console.warn('Sound playback error:', error.message);
    }
  }
}

export default SoundPlayer;
