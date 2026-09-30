// Subject code for grep-first evals: touches all four fixture packages.
import mongoose, { Schema } from "mongoose";
import { Command } from "commander";
import dotenv from "dotenv";
import { parse, stringify } from "yaml";

dotenv.config({ quiet: true });

const userSchema = new Schema({ email: { type: String, required: true }, name: String });
export const User = mongoose.model("User", userSchema);

export const program = new Command("app").option("-c, --config <file>", "YAML config file");

export function roundTrip(text: string): string {
  return stringify(parse(text));
}
