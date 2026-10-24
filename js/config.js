/* ============ CONFIG ============
   Edit only this file to connect your Supabase project. */
const SUPABASE_URL = "https://erhglpprztggbjqsyaps.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaGdscHByenRnZ2JqcXN5YXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1ODY1ODAsImV4cCI6MjEwODE2MjU4MH0.EmOVvcGMslfzVcyrfwztkzXe8PNE_R7dqdt-uoqxhVc";   // the "anon" key, public by design
const DOMAIN = "gym.app";                      // username "john" → john@gym.app
const CYCLE = 6;                               // every exercise is done once every 6 days
/* ================================== */

/* Special profiles: email → plan name (see js/plans.js). Anyone not listed uses the standard app.
   Example: when you create the user  ella@gym.app  in Supabase, add her here. Use lowercase. */
const PROFILES = {
  "betty@gym.app": "rose"
};

/* Recommended daily intake for the standard (men's) account.
   2,280 kcal = protein 600 kcal (150 g × 4) + fat 675 kcal (75 g × 9) + carbs 1,004 kcal (251 g × 4) */
const TARGETS_STANDARD = { kcal: 2280, protein: 150, fat: 75, carbs: 251 };