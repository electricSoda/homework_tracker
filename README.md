# Homework Tracker

A React-based homework tracker (vibe coded with AI), that helps me keep track of high priority tasks.
<img width="1512" height="828" alt="Screenshot 2026-11-24 at 10 07 39 PM" src="https://github.com/user-attachments/assets/561e8c34-b414-4fae-a41c-3072e1d3e77c" />


## Priority Model
I was initially considering doing the Three-Point Estimation (PERT) method to decide the best priority ranking, but ended up doing the following calculation instead because it was simpler, and also because I simply didn't have the bandwidth to research deeply into this. Anyways, it's been working wonders, so no complaints here.

`priorityRatio = hoursUntilDeadline / (estimatedHours * remainingFraction)`

## Deployment
I currently have this deployed on Cloudflare's serverless website service combined with Supabase for task-syncing across devices.

## Run it

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```
