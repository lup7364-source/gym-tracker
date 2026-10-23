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