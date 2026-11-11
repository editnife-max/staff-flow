// A made-up candidate for previewing templates before picking a real one.
import { buildCvData, type CvData } from "@/components/cv-layouts/cv-data";
import type { Candidate } from "@/lib/docx-fill";

const SAMPLE: Partial<Candidate> = {
  full_name: "SAMPLE CANDIDATE NAME",
  candidate_code: "SF-00123",
  passport_number: "EP0000000",
  passport_issue_date: "05/02/2022",
  passport_expiry_date: "04/02/2032",
  place_of_issue: "Addis Ababa",
  country: "Ethiopia",
  occupation: "House Maid",
  religion: "Christian",
  marital_status: "Single",
  education: "High School",
  english_level: "Good",
  arabic_level: "Fair",
  age: 27,
  dob: "14/03/1998",
  birth_place: "Addis Ababa",
  living_town: "Adama",
  children: 0,
  height: 160,
  weight: 55,
  experience: "Experienced",
  experience_country: "Saudi Arabia",
  experience_years: "2",
  narrative_phone: "+251 900 000 000",
  emergency_contact: "+251 911 000 000",
  notes: "Hard-working, honest and good with children.",
  video_url: "https://example.com/video",
  skills: "Cooking, Cleaning, Washing, Ironing, Child Care, Arab Cooking",
};

export function sampleCvData(): CvData {
  return buildCvData(SAMPLE as Candidate, { photo: null, fullPhoto: null });
}

export function candidateCvData(c: Candidate): CvData {
  return buildCvData(c, {
    photo: c.photo_url ?? c.full_photo_url,
    fullPhoto: c.full_photo_url ?? c.photo_url,
  });
}
