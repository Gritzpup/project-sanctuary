"""
Simple test that writes results to file
"""
import sys
import traceback

def write_log(message):
    with open("gpu_test_log.txt", "a") as f:
        f.write(message + "\n")
    print(message)  # Also print to console

write_log("=== GPU Test Log ===")
write_log(f"Python version: {sys.version}")

try:
    write_log("Testing ModernGL import...")
    import moderngl
    write_log("✅ ModernGL imported successfully")
    
    write_log("Testing pygame import...")
    import pygame
    write_log("✅ Pygame imported successfully")
    
    write_log("Initializing pygame...")
    pygame.init()
    write_log("✅ Pygame initialized")
    
    write_log("Creating display...")
    display = pygame.display.set_mode((100, 100), pygame.OPENGL | pygame.DOUBLEBUF | pygame.HIDDEN)
    write_log("✅ Display created")
    
    write_log("Creating ModernGL context...")
    ctx = moderngl.create_context()
    write_log("✅ ModernGL context created")
    write_log(f"GPU Info: {ctx.info}")
    
    ctx.release()
    pygame.quit()
    write_log("✅ ALL TESTS PASSED - GPU charts are ready!")
    
except Exception as e:
    write_log(f"❌ Error: {str(e)}")
    write_log(f"Traceback: {traceback.format_exc()}")

write_log("=== Test Complete ===")
