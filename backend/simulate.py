"""Pretend to be the Raspberry Pi: post a reading every few seconds.

Usage:  python simulate.py [--interval 5] [--url http://127.0.0.1:5000]
Keys while running: press Enter to toggle the bed between occupied and empty.
"""
import argparse
import json
import os
import random
import threading
import time
import urllib.request

from dotenv import load_dotenv

load_dotenv()
parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:5000")
parser.add_argument("--interval", type=float, default=5)
args = parser.parse_args()

state = {"occupied": True, "temp": 19.4}


def toggle():
    while True:
        input()
        state["occupied"] = not state["occupied"]
        print("Bed is now", "occupied" if state["occupied"] else "empty")


threading.Thread(target=toggle, daemon=True).start()
print("Posting readings. Press Enter to toggle occupancy, Ctrl+C to stop.")
while True:
    state["temp"] = round(min(max(state["temp"] + random.uniform(-0.15, 0.15), 15), 26), 1)
    body = {"occupied": state["occupied"], "temperature_c": state["temp"],
            "humidity_percent": round(random.uniform(50, 58), 1), "light_level": random.randint(30, 80)}
    req = urllib.request.Request(f"{args.url}/api/readings", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "X-API-Key": os.getenv("API_KEY", "")})
    try:
        with urllib.request.urlopen(req) as resp:
            r = json.load(resp)
            print(f"{r['recorded_at'][11:19]}  {'in bed ' if r['occupied'] else 'empty  '} {r['temperature_c']}°C  heating={'on' if r['heating_led_on'] else 'off'}")
    except Exception as err:
        print("POST failed:", err)
    time.sleep(args.interval)
