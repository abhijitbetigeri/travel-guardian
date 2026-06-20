# Antler Hack — Beta Hacks x Antler Hackathon

## Session context
- Hackathon: Beta Hacks (monthly high-velocity hackathon)
- Event date: 2026-06-20
- Submission deadline: 4:00 PM
- Demo: 3 min per team, then audience ranked-choice vote
- Prizes: 1st $600 | 2nd $500 | 3rd $400
- Bonus: Beta Fellowship ($25K) and Antler Residency fast-track for standouts

## Tracks
1. **Robotics & Embodied Agents** — perception, control, autonomy on real/simulated robots
2. **Sensing & Spatial Intelligence** — LiDAR, IMU, audio, thermal, depth → real-world decisions
3. **Video Intelligence & World Models** — video understanding, safety monitoring, world models
4. **Wildcard** — open category

## Submission
- All submissions via **Butterbase MCP**
- Butterbase promo code: `BUILDER0620` (redeem at dashboard.butterbase.ai/billing)
- $200 Butterbase credits award for Best Use of Butterbase
- Discord: https://discord.gg/cswGFwFumn

## Project overview
Personalized Travel Agent — traveler takes a photo/video, a world model (VILA 8B) recognizes the place, explains significance, nearby POIs, safety info. Chat-based follow-ups. Periodic AI-generated safety check-ins sent from traveler to guardian device.

Track: Video Intelligence & World Models

## Stack
- **World Model:** VILA 8B (NVIDIA) on Nebius Cloud (L40S GPU)
- **Backend:** Butterbase (schema, auth, data API, realtime WebSockets, serverless functions)
- **Frontend:** TBD (React or Next.js, deployed via Butterbase)
- **Submission:** Butterbase MCP

## Goals
MVP for 3-min demo:
1. Snap & Understand — photo → VILA → place ID + scene understanding
2. Smart Context — chat interface with Butterbase-stored location/safety data
3. Guardian Ping — realtime safety check-ins via Butterbase WebSockets
