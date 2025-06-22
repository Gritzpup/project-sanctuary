#!/bin/bash
# Build script to force webkit2gtk-4.1 usage

export PKG_CONFIG_PATH="/usr/lib/x86_64-linux-gnu/pkgconfig"
export WEBKIT_DISABLE_COMPOSITING_MODE=1

# Force webkit2gtk-4.1 instead of mixed versions
export WEBKIT2GTK_4_0_CFLAGS="$(pkg-config --cflags webkit2gtk-4.1)"
export WEBKIT2GTK_4_0_LIBS="$(pkg-config --libs webkit2gtk-4.1)"

echo "Building Aurora Chat with webkit2gtk-4.1 only..."
echo "WEBKIT2GTK_4_0_CFLAGS: $WEBKIT2GTK_4_0_CFLAGS"
echo "WEBKIT2GTK_4_0_LIBS: $WEBKIT2GTK_4_0_LIBS"

# Set up our custom library paths
export LIBRARY_PATH="/home/ubuntumain/Documents/Github/sanctuary/.local/lib:$LIBRARY_PATH"
export LD_LIBRARY_PATH="/home/ubuntumain/Documents/Github/sanctuary/.local/lib:$LD_LIBRARY_PATH"

cargo build --release
