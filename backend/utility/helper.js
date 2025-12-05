export default {
    generateMemberId() {
        return "M" + Math.floor(1000 + Math.random() * 9000);
    },

    generateGroupCode() {
        return "G" + Math.floor(1000 + Math.random() * 9000);
    }
};