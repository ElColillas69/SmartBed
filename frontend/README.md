# smartBed dashboard

React dashboard for caretakers and relatives keeping an eye on someone's bed: live occupancy, room climate, sleep history, heating and wake-up alarms. It connects to the Flask API by ../backend


```bash
# terminal running the backend
cd backend
python run.py
python seed_demo.py     # optional: a week of demo nights
python simulate.py      # optional: pretend to be the Pi (Enter toggles in/out of bed)

# different terminal running the frontend
cd frontend
npm install
npm run dev             # http://localhost:5173
```
