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
            resolve();
          } else {
            // Try aplay as fallback
            SoundPlayer.playWithAplay().then(resolve).catch(() => resolve());
          }
        });

        paplayProcess.on('error', (err) => {
          // If paplay fails, try aplay
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
          resolve();
        } else {
          resolve(); // Resolve anyway
        }
      });

      aplayProcess.on('error', (err) => {
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
          resolve();
        });

        process.on('error', () => {
          // Fail silently
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
    }
  }
}

export default SoundPlayer;
