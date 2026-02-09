import mongoose from "mongoose";

const RecoveryMasterSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    groupName: { type: String, required: true },
    groupCode: { type: String },

    // Recovery session details
    date: { type: Date, required: true },
    recoveryDate: { type: Date }, // Actual date recovery was done (e.g. 4 Feb when recovered on 4th)
    MeetingDate: { type: Date }, // Meeting date this recovery is for (e.g. 15 Feb when meeting 1=1, meeting 2=15 and recovered on 4th)
    meetingSequence: { type: Number, default: 1 },
    memberCount: { type: Number, default: 0 },
    groupPhoto: { type: String }, // base64 or URL

    // Individual member recoveries
    recoveries: [{
        memberId: { type: String, required: true },
        memberCode: { type: String, required: true },
        memberName: { type: String, required: true },
        attendance: { type: String, enum: ["present", "absent"], default: "present" },
        recoveryByOther: { type: Boolean, default: false },
        otherMemberId: { type: String },
        amounts: {
            saving: { type: Number, default: 0 },
            loan: { type: Number, default: 0 },
            interest: { type: Number, default: 0 }, // Interest on loan
            yogdan: { type: Number, default: 0 }, // Yogdan (when loan is given)
            memFeesSHG: { type: Number, default: 0 }, // Member Fees SHG (Yearly)
            memFeesSamiti: { type: Number, default: 0 }, // Member Fees Samiti (Yearly)
            memFeesGroup: { type: Number, default: 0 }, // Membership Group amount (from GroupMaster.Mship_Group)
            penalty: { type: Number, default: 0 },
            other: { type: Number, default: 0 },
            fd: { type: Number, default: 0 }, // FD is separate, not part of auto-calculation
            charges: { type: mongoose.Schema.Types.Mixed, default: {} }, // Dynamic charges: { [chargeName]: amount }
        },
        fd_time_period: { type: Number }, // Time period in months for new FD deposits (stored internally, but accepted in years from frontend)
        fd_rate_snapshot: { type: Number }, // Snapshot of fd_rate from group at time of FD creation
        paymentMode: {
            cash: { type: Boolean, default: false },
            online: { type: Boolean, default: false },
        },
        onlineRef: { type: String },
        bankId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BankMaster",
        }, // Bank reference for online payments
        screenshot: { type: String }, // base64 or URL
        total: { type: Number, default: 0 },
        // Demand details for tracking previous/current demands and balances
        demandDetails: {
            loan: {
                prevDemand: { type: Number, default: 0 },      // Previous month unpaid
                currDemand: { type: Number, default: 0 },      // Current month installment
                totalDemand: { type: Number, default: 0 },     // prev + curr
                actualPaid: { type: Number, default: 0 },      // Amount received
                unpaidDemand: { type: Number, default: 0 },    // total - actual
                openingBalance: { type: Number, default: 0 }, // Cumulative loan paid till now
                closingBalance: { type: Number, default: 0 }, // opening + actual
            },
            interest: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
            saving: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
            fd: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
        },
    }],

    // Totals
    totals: {
        totalCash: { type: Number, default: 0 },
        totalOnline: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
    },

    // Cash denomination breakdown (for totalCash)
    cashDenominations: {
        note200: { type: Number, default: 0 },   // Number of ₹200 notes
        note500: { type: Number, default: 0 },   // Number of ₹500 notes
        note100: { type: Number, default: 0 },   // Number of ₹100 notes
        note50: { type: Number, default: 0 },    // Number of ₹50 notes
        note20: { type: Number, default: 0 },     // Number of ₹20 notes
        note10: { type: Number, default: 0 },     // Number of ₹10 notes
        note5: { type: Number, default: 0 },     // Number of ₹5 notes
        note2: { type: Number, default: 0 },      // Number of ₹2 notes
        note1: { type: Number, default: 0 },      // Number of ₹1 coins/notes
    },

    // Status (for admin direct storage, always approved)
    status: { type: String, enum: ["approved", "rejected"], default: "approved" },

    // Approval status (for group panel requests)
    approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved" // Admin panel creates are auto-approved
    },
    approvedBy: { type: String }, // Admin who approved (if from group panel)
    approvedAt: { type: Date },
    rejectedBy: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },

    createdBy: { type: String }, // Admin user ID or "admin"

}, {
    timestamps: true,
});

// Add indexes for performance
RecoveryMasterSchema.index({ groupId: 1, date: 1 });
RecoveryMasterSchema.index({ 'recoveries.memberId': 1, date: 1 });
RecoveryMasterSchema.index({ groupId: 1, date: 1, 'recoveries.memberId': 1 });

export default mongoose.model("RecoveryMaster", RecoveryMasterSchema);

