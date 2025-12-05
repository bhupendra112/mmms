import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { Member } from "../../model/index.js";

export const registerMember = async(req, res) => {
    try {

        // Check if Member already exists
        const exist = await Member.findOne({ Member_Id: req.body.Member_Id });
        if (exist) {
            return apiResponse.error(res, message.MEMBER_EXISTS);
        }

        // Create new Member
        const member = await Member.create(req.body);

        return apiResponse.success(res, message.MEMBER_REGISTERED, member);

    } catch (error) {
        console.log("❌ Member Registration Error:", error);
        return apiResponse.error(res, error.message, 500);
    }
};