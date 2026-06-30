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
      "การใช้งาน Wi-Fi ของมหาวิทยาลัยกรุงเทพมี 2 รูปแบบหลัก: 1) BU-Airnet-xx หรือ BU AirNet 2.4G/5G เป็นการเชื่อมต่อแบบต้องใส่ Username/Password ของมหาวิทยาลัยเมื่อลงชื่อเข้าใช้ 2) BU Mobile, BU Mobile 2.4G/5G หรือ BU Wi-Fi6 เป็นการเชื่อมต่อแบบลงทะเบียน Wi-Fi MAC Address ของอุปกรณ์ก่อน เมื่อเชื่อมต่อแล้วจะใช้งานได้โดยไม่ต้อง Sign in ใหม่ทุกครั้ง วิธีใช้งานแบบลงทะเบียนอุปกรณ์: ปิด Random MAC Address หรือ Private Wi-Fi Address ของอุปกรณ์ก่อน, ดูหมายเลข Wi-Fi MAC Address ของอุปกรณ์, เข้าเว็บไซต์ inet.bu.ac.th, เลือกเมนู BU Wi-Fi MAC Address, ติ๊กยอมรับเงื่อนไขหรือ I Agree แล้วกด Next Step, กรอกข้อมูลให้ครบโดยเฉพาะ Wi-Fi MAC Address แล้วกด Save, จากนั้นทดสอบเชื่อมต่อ Wi-Fi ชื่อ BU Wi-Fi6, BU Mobile 2.4G หรือ BU Mobile 5G หากใช้ไม่ได้ให้ตรวจสอบว่าเชื่อมต่อ SSID ของมหาวิทยาลัยจริงหรือไม่, ปิด Random MAC Address แล้วหรือยัง, MAC Address ตรงกับที่ลงทะเบียนหรือไม่, ลองสลับระหว่าง 2.4G และ 5G ตามความแรงสัญญาณ หากยังมีปัญหาให้ติดต่อ Line@BU IT Support: @snz0536j, email: compcenter@bu.ac.th หรือโทร 02 407 3888 ต่อ 2710",
    keywords: [
      "wifi",
      "wi-fi",
      "ไวไฟ",
      "อินเทอร์เน็ต",
      "internet",
      "network",
      "bu airnet",
      "bu mobile",
      "bu wi-fi6",
      "mac address",
      "random mac"
    ],
    source: "BU FAQ: https://faq.bu.ac.th/wordpress/bu-mobile/"
  }
];
