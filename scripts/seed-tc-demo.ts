import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zkdaesxvkephaekxprsh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZGFlc3h2a2VwaGFla3hwcnNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1ODc0NywiZXhwIjoyMDk0NTM0NzQ3fQ.7wTHHyMCaqTfFRC2Ms7afseBSV9y-6c0_Ds83B5SbB8",
);

// Find the manager (user with role = 'manager')
const { data: roles, error: rolesErr } = await supabase
  .from("user_roles")
  .select("user_id")
  .eq("role", "manager")
  .limit(1)
  .single();

if (rolesErr || !roles) {
  console.error("Could not find manager:", rolesErr?.message);
  process.exit(1);
}

const managerId = roles.user_id;
console.log("Manager ID:", managerId);

const today = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const GIRLS = [
  { first: "Tigist",   last: "BEKELE",   dob: "1998-03-12", labour: "EF12345678", passport: "EP1234561" },
  { first: "Hana",     last: "TESFAYE",  dob: "2000-07-22", labour: "EF12345679", passport: "EP1234562" },
  { first: "Meron",    last: "ALEMU",    dob: "1997-11-05", labour: "EF12345680", passport: "EP1234563" },
  { first: "Selam",    last: "HAILE",    dob: "1999-01-30", labour: "EF12345681", passport: "EP1234564" },
  { first: "Rahel",    last: "GIRMA",    dob: "2001-05-18", labour: "EF12345682", passport: "EP1234565" },
  { first: "Betlehem", last: "TADESSE",  dob: "1996-09-08", labour: "EF12345683", passport: "EP1234566" },
  { first: "Yodit",    last: "DESTA",    dob: "2002-12-14", labour: "EF12345684", passport: "EP1234567" },
  { first: "Mahlet",   last: "WORKU",    dob: "1998-06-25", labour: "EF12345685", passport: "EP1234568" },
  { first: "Liya",     last: "SOLOMON",  dob: "2000-02-03", labour: "EF12345686", passport: "EP1234569" },
  { first: "Eden",     last: "MEKONNEN", dob: "1999-08-17", labour: "EF12345687", passport: "EP1234570" },
];

const issueDate = dateStr(new Date(today.getFullYear() - 2, today.getMonth(), today.getDate()));
const expiryDate = dateStr(new Date(today.getFullYear() + 8, today.getMonth(), today.getDate()));

const rows = GIRLS.map((g, i) => ({
  manager_id:           managerId,
  full_name:            `${g.first} ${g.last}`,
  first_name:           g.first,
  last_name:            g.last,
  gender:               "Female",
  dob:                  g.dob,
  religion:             "Muslim",
  birth_place:          "ADDIS ABABA",
  living_town:          "ADDIS ABABA",
  marital_status:       "Single",
  education:            "Secondary",
  country:              "Ethiopian",
  occupation:           "House Maid",
  passport_number:      g.passport,
  labour_id:            g.labour,
  passport_issue_date:  issueDate,
  passport_expiry_date: expiryDate,
  place_of_issue:       "ADDIS ABABA",
  experience:           "No",
  passport_status:      "Original",
  medical_status:       "Fit",
  coc_status:           "Done",
  musaned_status:       "Saudi Arabia",
  cv_sent_to:           "Saudi Arabia",
  cv_sent_date:         dateStr(today),
  status:               "available",
  availability_type:    "TC",
  skills:               "Ironing, Cleaning",
  candidate_code:       `DEMO${String(i + 1).padStart(3, "0")}`,
}));

const { error } = await supabase.from("candidates").insert(rows);

if (error) {
  console.error("Insert failed:", error.message);
  process.exit(1);
}

console.log(`✓ Inserted ${rows.length} demo TC candidates`);
