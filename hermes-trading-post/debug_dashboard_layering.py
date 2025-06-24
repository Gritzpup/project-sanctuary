#!/usr/bin/env python3
"""
Debug if dashboard is layering multiple chart images
"""
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

print("Checking if dashboard is layering multiple chart images...")

# Setup headless Chrome
options = Options()
options.add_argument("--headless")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

try:
    driver = webdriver.Chrome(options=options)
    
    # Load dashboard
    driver.get("http://localhost:8050")
    time.sleep(3)  # Wait for initial load
    
    # Find chart images
    chart_images = driver.find_elements(By.CSS_SELECTOR, "#btc-chart-chart img")
    print(f"Found {len(chart_images)} chart images")
    
    if len(chart_images) > 1:
        print("❌ Multiple chart images found! This is the issue.")
        for i, img in enumerate(chart_images):
            print(f"  Image {i+1}: {img.get_attribute('id')}")
    else:
        print("✓ Only one chart image found")
        
    # Check chart container structure
    chart_container = driver.find_element(By.ID, "btc-chart-chart")
    inner_html = chart_container.get_attribute("innerHTML")
    print(f"\nChart container HTML length: {len(inner_html)}")
    
    # Wait and check again
    time.sleep(5)
    chart_images_after = driver.find_elements(By.CSS_SELECTOR, "#btc-chart-chart img")
    print(f"\nAfter 5 seconds: {len(chart_images_after)} chart images")
    
    driver.quit()
    
except Exception as e:
    print(f"Selenium test failed (dashboard might not be running): {e}")
    print("\nAlternative: Check the dashboard HTML structure manually")

# Alternative check - examine the callback behavior
print("\n\nChecking callback configuration...")
print("""
The issue might be that:
1. The chart callback is creating new img elements without replacing the old ones
2. The unique IDs on each img are causing Dash to append rather than replace
3. CSS positioning might be overlaying images

To fix:
1. Ensure the callback replaces the entire content of 'btc-chart-chart'
2. Remove unique IDs from img elements
3. Check CSS for absolute positioning
""")