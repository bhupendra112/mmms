import mongoose from "mongoose";
import GroupMaster from "../model/GroupMaster.js";
import Member from "../model/Member.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Migration script to:
 * 1. Convert Mship_Group from String to Number in GroupMaster
 * 2. Initialize lastMembershipPaidDate and lastMembershipGroupPaidDate for existing members
 */
async function migrateMshipGroup() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/mmms";
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB");

        // Step 1: Convert Mship_Group from String to Number in GroupMaster
        console.log("\n=== Step 1: Converting Mship_Group from String to Number ===");
        const groups = await GroupMaster.find({ Mship_Group: { $exists: true, $type: "string" } });
        console.log(`Found ${groups.length} groups with String Mship_Group`);

        let convertedCount = 0;
        for (const group of groups) {
            const oldValue = group.Mship_Group;
            let newValue = 0;

            if (oldValue && typeof oldValue === "string") {
                // Try to parse as number
                const parsed = parseFloat(oldValue);
                if (!isNaN(parsed)) {
                    newValue = parsed;
                } else {
                    // If not numeric, default to 0
                    newValue = 0;
                    console.log(`  Group ${group.group_name} (${group.group_code}): "${oldValue}" -> 0 (not numeric)`);
                }
            }

            if (oldValue !== newValue) {
                await GroupMaster.findByIdAndUpdate(group._id, { Mship_Group: newValue });
                console.log(`  Group ${group.group_name} (${group.group_code}): "${oldValue}" -> ${newValue}`);
                convertedCount++;
            }
        }
        console.log(`Converted ${convertedCount} groups`);

        // Step 2: Initialize lastMembershipPaidDate for existing members based on join date
        console.log("\n=== Step 2: Initializing membership payment dates for existing members ===");
        const members = await Member.find({
            $or: [
                { lastMembershipPaidDate: { $exists: false } },
                { lastMembershipPaidDate: null },
                { lastMembershipGroupPaidDate: { $exists: false } },
                { lastMembershipGroupPaidDate: null }
            ]
        });
        console.log(`Found ${members.length} members without membership payment dates`);

        let initializedCount = 0;
        for (const member of members) {
            const updateFields = {};
            const joinDate = member.Dt_Join || member.Member_Dt || member.createdAt;

            if (joinDate && (!member.lastMembershipPaidDate || !member.lastMembershipGroupPaidDate)) {
                // Set payment dates to join date (they paid when they joined)
                if (!member.lastMembershipPaidDate) {
                    updateFields.lastMembershipPaidDate = new Date(joinDate);
                }
                if (!member.lastMembershipGroupPaidDate) {
                    updateFields.lastMembershipGroupPaidDate = new Date(joinDate);
                }

                if (Object.keys(updateFields).length > 0) {
                    await Member.findByIdAndUpdate(member._id, updateFields);
                    console.log(`  Member ${member.Member_Nm} (${member.Member_Id}): Initialized payment dates`);
                    initializedCount++;
                }
            }
        }
        console.log(`Initialized ${initializedCount} members`);

        console.log("\n=== Migration completed successfully ===");
        process.exit(0);
    } catch (error) {
        console.error("Migration error:", error);
        process.exit(1);
    }
}

// Run migration
migrateMshipGroup();

