export function formatOutOfScopeReply(message: string) {
  return /[\u0E00-\u0E7F]/.test(message)
    ? "เรื่องนี้อยู่นอกขอบเขตของ StudyMate ครับ ผมช่วยเรื่องข้อมูล BU บทเรียน และการแจ้งปัญหาภายในมหาวิทยาลัยได้"
    : "That is outside StudyMate's scope. I can help with BU information, study materials, and campus issue reports.";
}

export function formatUnverifiedBuReply(message: string) {
  return /[\u0E00-\u0E7F]/.test(message)
    ? "ยังไม่มีข้อมูลทางการที่ยืนยันเรื่องนี้ได้ครับ ต้องการข้อมูลสำหรับหลักสูตรหรือหน่วยงานไหนครับ?"
    : "I don't have verified BU information about that yet. Which program or department is this for?";
}
