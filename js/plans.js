/* ============ SPECIAL PLANS ============
   A user listed in PROFILES (js/config.js) gets this theme and this fixed routine
   instead of the standard rotating plan.
   Each routine item: [exercise name, sets, reps, suggested weight]
   weekdays: which routine on which weekday (0 = Sunday … 6 = Saturday → routine index 0, 1, 2). */
const PLANS = {
  rose: {
    theme: "rose",
    targets: { kcal: 2000, protein: 0, fat: 0, carbs: 0 },   // placeholder until her recommended intake is defined
    colors: { legs: "#ff5d73", chest: "#ff9dd1", back: "#c9a7ff", shoulders: "#ffb88c", arms: "#e58bff", core: "#ffd1e8" },
    weekdays: { 1: 0, 3: 1, 5: 2 },          // Mon = Day 1, Wed = Day 2, Fri = Day 3
    // name: [muscle group, type, starting weight shown as placeholder]
    ex: {
      "Leg press":                 ["legs", "compound", 20],
      "Leg extension":             ["legs", "isolation", 5],
      "Seated leg curl":           ["legs", "isolation", 5],
      "Machine hip thrust":        ["legs", "compound", 10],
      "Calf raise":                ["legs", "isolation", 0],
      "Treadmill walk":            ["legs", "isolation", 0],
      "Lat pulldown":              ["back", "compound", 10],
      "Machine chest press":       ["chest", "compound", 5],
      "Seated row (machine)":      ["back", "compound", 10],
      "Dumbbell biceps curl":      ["arms", "isolation", 2],
      "Cable triceps extension":   ["arms", "isolation", 5],
      "Dumbbell squat":            ["legs", "compound", 4],
      "Pallof press":              ["core", "isolation", 2.5],
      "Plank":                     ["core", "isolation", 0],
      "Stationary bike":           ["legs", "isolation", 0]
    },
    days: [
      { title: "Legs & glutes", time: "50–60 min", items: [
        ["Leg press", 3, "10–12", "20–40 kg"],
        ["Leg extension", 2, "12–15", "5–15 kg"],
        ["Seated leg curl", 3, "10–12", "5–15 kg"],
        ["Machine hip thrust", 3, "10–12", "10–25 kg"],
        ["Calf raise", 2, "12–15", "Bodyweight or 5–10 kg"],
        ["Treadmill walk", 1, "10 min", "No weight"]
      ]},
      { title: "Back, chest & arms", time: "50–60 min", items: [
        ["Lat pulldown", 3, "10–12", "10–20 kg"],
        ["Machine chest press", 3, "10–12", "5–15 kg"],
        ["Seated row (machine)", 3, "10–12", "10–20 kg"],
        ["Dumbbell biceps curl", 2, "12", "2–5 kg per hand"],
        ["Cable triceps extension", 2, "12", "5–10 kg"],
        ["Treadmill walk", 1, "10–15 min", "No weight"]
      ]},
      { title: "Full body & abs", time: "50–60 min", items: [
        ["Dumbbell squat", 2, "10–12", "4–8 kg"],
        ["Seated leg curl", 2, "12", "5–15 kg"],
        ["Seated row (machine)", 2, "12", "10–20 kg"],
        ["Machine chest press", 2, "12", "5–15 kg"],
        ["Pallof press", 2, "10 per side", "2.5–5 kg"],
        ["Plank", 2, "20–30 sec", "Bodyweight"],
        ["Stationary bike", 1, "10–15 min", "Light resistance"]
      ]}
    ]
  }
};