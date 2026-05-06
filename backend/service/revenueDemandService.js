/**
 * MemberRevenueDemand upserts — replaces inline MemberRevenueDemand.create in membership flows.
 * IDEMPOTENCY: callers should pass deterministic keys (year, isAnnualDemand, etc.).
 */

import mongoose from "mongoose";
import MemberRevenueDemand from "../model/MemberRevenueDemand.js";

export async function upsertAnnualMembershipDemand({
    memberId,
    groupId,
    year,
    revenueType,
    amount,
    demandDate = new Date(),
    notes = "Annual demand (April)",
}) {
    const filter = {
        memberId: new mongoose.Types.ObjectId(memberId),
        groupId: new mongoose.Types.ObjectId(groupId),
        revenueType,
        isAnnualDemand: true,
        year,
    };
    const update = {
        $setOnInsert: {
            memberId: filter.memberId,
            groupId: filter.groupId,
            revenueType,
            isAnnualDemand: true,
            year,
            demandDate,
            isPaid: false,
            paidAmount: 0,
        },
        $set: { amount, notes },
    };
    return MemberRevenueDemand.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    });
}

export async function upsertRegistrationMembershipDemand({
    memberId,
    groupId,
    revenueType,
    amount,
    year,
    demandDate = new Date(),
    notes = "New member registration demand",
}) {
    const filter = {
        memberId: new mongoose.Types.ObjectId(memberId),
        groupId: new mongoose.Types.ObjectId(groupId),
        revenueType,
        isAnnualDemand: false,
    };
    const update = {
        $setOnInsert: {
            memberId: filter.memberId,
            groupId: filter.groupId,
            revenueType,
            isAnnualDemand: false,
            year,
            demandDate,
            isPaid: false,
            paidAmount: 0,
        },
        $set: { amount, notes },
    };
    return MemberRevenueDemand.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    });
}

export async function addPenaltyDemand({
    memberId,
    groupId,
    amount,
    demandDate,
    notes = "",
    meetingKey,
}) {
    const doc = await MemberRevenueDemand.create({
        memberId: new mongoose.Types.ObjectId(memberId),
        groupId: new mongoose.Types.ObjectId(groupId),
        revenueType: "penalty",
        amount,
        demandDate,
        year: String(demandDate.getFullYear()),
        notes,
        isPaid: false,
        paidAmount: 0,
        isAnnualDemand: false,
        meetingKey,
    });
    return doc;
}
