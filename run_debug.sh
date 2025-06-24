#\!/bin/bash
# Run with debug logging
export PYTHONUNBUFFERED=1
export DASH_DEBUG=True
python3 -c "
import logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# Set debug level for chart components
logging.getLogger('components.chart_acceleration').setLevel(logging.DEBUG)
exec(open('dash_app.py').read())
"
