# 📡 SDR Entropy Extraction Setup & Test Protocol

This version includes methods for capturing entropy both with a CRT TV (analog noise injection) and without one—using ambient RF spectrum and atmospheric noise captured from a rooftop or elevated SDR antenna.

This document outlines the full process of capturing physical entropy from analog static using an RTL-SDR device and preparing it for cryptographic-quality entropy streams used in the LightSeed framework. It includes hardware, software setup, test goals, and real code examples.

---

## 🎯 Objective

Capture RF noise from a CRT TV (or ambient analog signal sources) via SDR, extract entropy using signal processing (FFT), and fold it into high-quality entropy buffers for use in AI initialization (e.g., LoRA, GPTQ).

---

## 🔧 Hardware Required

You can run this protocol in two modes:

- **With CRT TV**: Use a known analog static source to drive RF/EM fuzz

- **Without CRT TV**: Use rooftop SDR antenna to gather atmospheric noise from quiet bands

- **RTL-SDR v3 dongle** (compatible with rtl\_sdr, rtl\_power)

- **Antenna** (stock whip, discone, or custom loop)

- **CRT TV** (or any analog noise source)

- **Linux/macOS/WSL environment** (Ubuntu recommended)

- **Optional**: Oscilloscope, EM coil for field comparison

---

## 🛠️ Software Setup

### Step 1: Install RTL-SDR Tools

```bash
sudo apt update
sudo apt install rtl-sdr gnuradio gqrx -y
```

Verify your dongle is working:

```bash
rtl_test
```

Expected output: should list tuning range and confirm no conflicts.

---

## ⚙️ SDR Tuning Parameters

### If Using Rooftop Antenna Only:

- Capture from **quiet spectrum bands** far from FM radio or TV broadcast
- Focus on: 27 MHz (CB), 137 MHz (NOAA spillover), 462 MHz (FRS), 915 MHz (ISM)
- Do multiple time-of-day tests (sunrise/sunset can affect ionospheric noise)

### If Using CRT TV:

- Position SDR antenna 1–2 meters from active CRT
- Tune to harmonics \~55–70 MHz or any visible spike in RF emission

| Parameter    | Recommended Setting                |
| ------------ | ---------------------------------- |
| Frequency    | 55–900 MHz (choose quiet zone)     |
| Sample Rate  | 2.048 MS/s (or max supported)      |
| Gain         | 35–49.6 dB (adjust for best noise) |
| Capture Time | 30 seconds – 5 minutes             |
| FFT Bins     | 1024 or 2048                       |

**Suggested quiet frequencies for entropy**:

- 55 MHz, 144 MHz, 462 MHz (non-broadcast gaps)

---

## 📡 Entropy Capture Using `rtl_power`

This is the default method using processed power spectrum data. For deeper entropy access, see the alternate raw IQ method below.

Record spectrum across 10 MHz chunk:

```bash
rtl_power -f 462M:472M:2k -i 1s -e 1m -g 49 -c 20 -F 9 - | tee rf_spectrum.csv
```

Explanation:

- `-f`: frequency band (462–472 MHz with 2kHz bins)
- `-i`: integration interval (1 second)
- `-e`: total capture duration
- `-g`: gain in dB (try 40–49.6)
- `-c`: enable DC removal
- `-F 9`: output in CSV (spectrum)

---

## 🧪 First Entropy Test (Python FFT Pipeline)

Install dependencies:

```bash
pip install numpy pandas matplotlib scipy
```

### Python Script to Process CSV and Extract Entropy

```python
import numpy as np
import pandas as pd
import hashlib

# Load CSV from rtl_power
spectrum = pd.read_csv("rf_spectrum.csv", comment='#')
data = spectrum.iloc[:, 6:].values.flatten()

# Normalize
data = (data - np.mean(data)) / np.std(data)

# Apply FFT
fft = np.fft.fft(data)
mag = np.abs(fft[:len(fft)//2])

# Hash FFT values to get entropy chunk
digest = hashlib.sha512(mag.tobytes()).hexdigest()
print("Entropy Seed:", digest[:64])
```

---

## 📈 Optional Visualization

```python
import matplotlib.pyplot as plt
plt.plot(mag)
plt.title("FFT Spectrum Magnitude")
plt.xlabel("Frequency Bin")
plt.ylabel("Magnitude")
plt.grid(True)
plt.show()
```

---

## 🧪 Alternate Method: Raw IQ Capture with `rtl_sdr`

If you'd like to process raw radio waveforms (IQ samples) directly, this method provides more entropy-rich detail:

### Step 1: Capture IQ Baseband Data

```bash
rtl_sdr -f 462M -s 2048000 -g 45 -n 40960000 raw_iq.bin
```

- `-f`: target frequency (adjust as needed)
- `-s`: sample rate (2.048 MS/s max for RTL-SDR)
- `-n`: number of samples (40960000 = \~20 sec)
- `-g`: tuner gain

### Step 2: Python Script for Entropy Extraction

```python
import numpy as np
import hashlib

# Read raw IQ data
raw = np.fromfile("raw_iq.bin", dtype=np.uint8).astype(np.float32)
raw -= 127.5  # center around 0
raw /= 127.5

# Separate I/Q
i = raw[::2]
q = raw[1::2]
iq_complex = i + 1j * q

# FFT and magnitude
fft = np.fft.fft(iq_complex)
mag = np.abs(fft[:len(fft)//2])

# Hash to entropy
entropy_seed = hashlib.sha512(mag.tobytes()).hexdigest()
print("Raw IQ Entropy Seed:", entropy_seed[:64])
```

---

### A. Rooftop Antenna Mode (No CRT)

1. Run `rtl_power` on 10 MHz slices starting from 27 MHz up to 1 GHz
2. Choose clean bands with high background variability (low steady broadcast)
3. Sample over 5+ minutes for better entropy buildup
4. Proceed to FFT + SHA pipeline

### B. CRT Injection Mode (With CRT)

1. Place antenna 1–2 m from CRT screen or yoke
2. Tune CRT to static (no channel)
3. Scan known noisy harmonics: 55 MHz, 144 MHz, 462 MHz
4. Capture RF for 1–2 minutes in fine FFT bins

Both paths produce usable entropy after FFT transformation and hashing.

1. Place RTL-SDR antenna \~1m from CRT TV tuned to static.
2. Run `rtl_power` for 1–5 minutes across suggested bands.
3. Import data into Python and run FFT script.
4. Generate hash as entropy seed.
5. Compare entropy seeds between different captures.
6. Log entropy stability, uniqueness, and randomness.

Optional: Run `dieharder` or NIST STS tests on entropy strings.

---

## 🔬 Reference Sources

- Park et al., 2024 – Analog entropy extraction via FFT: [https://doi.org/10.3390/electronics13010097](https://doi.org/10.3390/electronics13010097)
- NIST STS toolkit: [https://csrc.nist.gov/projects/random-bit-generation](https://csrc.nist.gov/projects/random-bit-generation)
- RTL-SDR Guide: [https://rtl-sdr.com/rtl-sdr-quick-start-guide/](https://rtl-sdr.com/rtl-sdr-quick-start-guide/)

---

*Maintained by Gritz for LightSeed Entropy Initiative, 2025.*

