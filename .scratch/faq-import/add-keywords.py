"""Add Thai/English keyword equivalents to faq-source.json (run with: python -X utf8 add-keywords.py).

Keywords feed the Thai/English full-text leg only; they are not part of the embedding text.
"""
import json, re, sys

SOURCE = 'faq-source.json'

# term found in title/content (case-insensitive) -> keywords to add
EN_TO_TH = {
    'password': ['รหัสผ่าน', 'พาสเวิร์ด'],
    'reset password': ['รีเซ็ตรหัสผ่าน'],
    'transcript': ['ใบเกรด', 'ใบรายงานผลการศึกษา', 'ทรานสคริป'],
    'drop': ['ลดวิชา', 'ดรอป'],
    'withdrawal': ['เพิกถอนวิชา', 'ถอนวิชา'],
    'wi-fi': ['ไวไฟ', 'ไวฟาย'],
    'resume': ['เรซูเม่', 'ประวัติย่อ'],
    'bu account': ['บัญชีผู้ใช้', 'บียูแอคเคานต์'],
    'username': ['ชื่อผู้ใช้', 'ยูสเซอร์เนม'],
    'login': ['ล็อกอิน', 'เข้าสู่ระบบ'],
    'vpn': ['วีพีเอ็น'],
    'teams': ['ทีมส์', 'ไมโครซอฟต์ทีมส์'],
    'office 365': ['ออฟฟิศ 365'],
    'bu mail': ['อีเมลมหาวิทยาลัย', 'อีเมลนักศึกษา'],
    'section': ['เซคชั่น', 'กลุ่มเรียน'],
    'freeze': ['ฟรีซ', 'ที่นั่งเต็ม'],
    'line': ['ไลน์'],
    'qr': ['คิวอาร์'],
    'gpa': ['เกรดเฉลี่ย'],
    'ems': ['ไปรษณีย์'],
    'recommendation letter': ['จดหมายรับรอง', 'จดหมายแนะนำ'],
    'mac address': ['แมคแอดเดรส'],
}
TH_TO_EN = {
    'ใบรายงานผลการศึกษา': ['transcript', 'academic record'],
    'เอกสารสำคัญทางการศึกษา': ['official document', 'transcript', 'certificate', 'request'],
    'ค่าธรรมเนียม': ['fee', 'cost'],
    'ลาพักการศึกษา': ['leave of absence', 'suspend studies'],
    'ลาออก': ['resign', 'withdraw from university'],
    'ย้ายคณะ': ['change faculty', 'transfer faculty'],
    'ย้ายสาขา': ['change major'],
    'บัตรนักศึกษา': ['student id card'],
    'ใบเสร็จรับเงิน': ['receipt'],
    'ผ่อนชำระ': ['installment', 'pay in installments'],
    'ลงทะเบียนเรียน': ['course registration', 'enroll'],
    'เกรด': ['grade'],
    'ปริญญาบัตร': ['diploma', 'degree certificate'],
    'ชุดครุย': ['graduation gown'],
    'ขึ้นทะเบียนบัณฑิต': ['graduation registration'],
    'ประกันอุบัติเหตุ': ['accident insurance'],
    'ทุนการศึกษา': ['scholarship'],
    'ที่จอดรถ': ['parking'],
    'ห้องพยาบาล': ['clinic', 'infirmary'],
    'เพิกถอนวิชา': ['withdraw course', 'withdrawal'],
    'ลดวิชา': ['drop course'],
    'ผ่อนผันทหาร': ['military deferment'],
    'ค่าประกันความเสียหาย': ['damage deposit', 'security deposit'],
    'แจ้งจบ': ['apply to graduate', 'graduation application'],
    'สำนักทะเบียน': ['registrar', 'registration office'],
    'เงินกู้': ['student loan'],
    'ลืม Password': ['forgot password'],
    'ตารางเรียน': ['class schedule', 'timetable'],
}


def main():
    items = json.load(open(SOURCE, encoding='utf8'))
    added = 0
    for item in items:
        text = (item['title'] + '\n' + item['content']).lower()
        extra = []
        for term, words in EN_TO_TH.items():
            if re.search(r'(?<![a-z])' + re.escape(term) + r'(?![a-z])', text):
                extra += words
        for term, words in TH_TO_EN.items():
            if term.lower() in text:
                extra += words
        if 'ลืม' in item['title'] and 'password' in text:
            extra += ['ลืมรหัสผ่าน', 'ลืมพาสเวิร์ด']
        seen = {k.lower() for k in item['keywords']}
        for word in extra:
            if word.lower() not in seen and len(word) <= 50 and len(item['keywords']) < 30:
                item['keywords'].append(word)
                seen.add(word.lower())
                added += 1
    json.dump(items, open(SOURCE, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(len(items), 'items;', added, 'keywords added')


if __name__ == '__main__':
    sys.exit(main())
