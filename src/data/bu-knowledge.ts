export type DemoKnowledgeRecord = {
  title: string;
  category: string;
  content: string;
  keywords: string[];
  source: string;
};

export const buKnowledgeRecords: DemoKnowledgeRecord[] = [
  {
    title: "BU Wi-Fi",
    category: "IT Support",
    content:
      "นักศึกษาสามารถใช้งาน Wi-Fi ของมหาวิทยาลัยด้วยบัญชีผู้ใช้ของมหาวิทยาลัย หากเข้าใช้งานไม่ได้ แนะนำให้ตรวจสอบรหัสผ่าน ลองเชื่อมต่อใหม่ และติดต่อ IT Support พร้อมแจ้งรหัสนักศึกษาและอุปกรณ์ที่ใช้งาน",
    keywords: ["wifi", "wi-fi", "ไวไฟ", "อินเทอร์เน็ต", "internet", "network"],
    source: "Demo verified knowledge base"
  },
  {
    title: "University Holidays",
    category: "Academic Calendar",
    content:
      "วันหยุดและกำหนดการเรียนการสอนอาจเปลี่ยนแปลงได้ นักศึกษาควรตรวจสอบประกาศล่าสุดจากเว็บไซต์หรือช่องทางทางการของมหาวิทยาลัยก่อนวางแผนเสมอ",
    keywords: ["holiday", "holidays", "วันหยุด", "ปฏิทิน", "calendar", "หยุดเรียน"],
    source: "Demo verified knowledge base"
  },
  {
    title: "Activity Registration",
    category: "Student Activities",
    content:
      "การลงทะเบียนกิจกรรมนักศึกษาควรทำผ่านระบบหรือช่องทางที่มหาวิทยาลัยประกาศไว้ ตรวจสอบรายละเอียดกิจกรรม เงื่อนไข และกำหนดเวลาจากประกาศทางการก่อนลงทะเบียน",
    keywords: ["activity", "activities", "กิจกรรม", "ลงทะเบียนกิจกรรม", "ชมรม"],
    source: "Demo verified knowledge base"
  },
  {
    title: "Admissions Contact",
    category: "Admissions",
    content:
      "คำถามเกี่ยวกับการสมัครเรียน หลักสูตร หรือเอกสารรับสมัคร ควรติดต่อช่องทาง Admissions ของมหาวิทยาลัยโดยตรง เพื่อรับข้อมูลล่าสุดและถูกต้องตามรอบรับสมัคร",
    keywords: ["admission", "admissions", "สมัครเรียน", "รับสมัคร", "หลักสูตร", "เรียนต่อ"],
    source: "Demo verified knowledge base"
  },
  {
    title: "Library Information",
    category: "Library",
    content:
      "ห้องสมุดให้บริการทรัพยากรการเรียนรู้ พื้นที่อ่านหนังสือ และบริการค้นคว้า นักศึกษาควรตรวจสอบเวลาเปิดบริการและเงื่อนไขการยืมคืนจากช่องทางทางการของห้องสมุด",
    keywords: ["library", "ห้องสมุด", "ยืมหนังสือ", "อ่านหนังสือ", "ค้นคว้า"],
    source: "Demo verified knowledge base"
  },
  {
    title: "Student ID Card",
    category: "Student Services",
    content:
      "หากบัตรนักศึกษามีปัญหา สูญหาย หรือต้องการสอบถามเรื่องการใช้งานบัตร ให้ติดต่อหน่วยงานบริการนักศึกษาหรือช่องทางที่มหาวิทยาลัยกำหนด พร้อมเตรียมข้อมูลยืนยันตัวตน",
    keywords: ["student id", "id card", "บัตรนักศึกษา", "บัตรหาย", "student card"],
    source: "Demo verified knowledge base"
  },
  {
    title: "Classroom Building Information",
    category: "Campus Facilities",
    content:
      "ข้อมูลอาคารเรียน ห้องเรียน และเส้นทางภายในมหาวิทยาลัยควรตรวจสอบจากแผนที่มหาวิทยาลัยหรือประกาศของคณะ/รายวิชา หากไม่แน่ใจ ให้แจ้งชื่ออาคาร ห้อง หรือรหัสวิชาเพื่อให้เจ้าหน้าที่ช่วยตรวจสอบ",
    keywords: ["building", "classroom", "อาคาร", "ห้องเรียน", "ตึก", "แผนที่"],
    source: "Demo verified knowledge base"
  },
  {
    title: "IT Support",
    category: "IT Support",
    content:
      "สำหรับปัญหาบัญชีผู้ใช้ Wi-Fi ระบบออนไลน์ หรืออุปกรณ์ไอทีของมหาวิทยาลัย ให้ติดต่อ IT Support พร้อมรายละเอียดปัญหา อุปกรณ์ที่ใช้ และภาพหน้าจอถ้ามี",
    keywords: ["it", "support", "ช่วยเหลือ", "ระบบ", "บัญชี", "password", "รหัสผ่าน"],
    source: "Demo verified knowledge base"
  },
  {
    title: "Scholarship Information",
    category: "Scholarship",
    content:
      "ข้อมูลทุนการศึกษา เงื่อนไข และกำหนดรับสมัครอาจแตกต่างกันในแต่ละรอบ นักศึกษาควรติดตามประกาศจากช่องทางทางการของมหาวิทยาลัยหรือสอบถามหน่วยงานที่ดูแลทุนโดยตรง",
    keywords: ["scholarship", "ทุน", "ทุนการศึกษา", "financial aid"],
    source: "Demo verified knowledge base"
  },
  {
    title: "General Contact Channels",
    category: "Contact",
    content:
      "สำหรับคำถามทั่วไป แนะนำให้ติดต่อช่องทางทางการของมหาวิทยาลัย เช่น เว็บไซต์หลัก เพจ/LINE OA ทางการ หรือหน่วยงานที่เกี่ยวข้องโดยตรง เพื่อให้ได้ข้อมูลล่าสุดและตรวจสอบได้",
    keywords: ["contact", "ติดต่อ", "เบอร์", "โทร", "อีเมล", "ช่องทาง"],
    source: "Demo verified knowledge base"
  }
];
