const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

app.use(session({
    secret: 'work_manage_secret_key_123',
    resave: false,
    saveUninitialized: true
}));

app.set('view engine', 'ejs');

// [MongoDB 연동] 네가 알려준 접속 주소
const MONGO_URI = "mongodb+srv://szdf122_db_user:ipmqj6hw42L8RI5v@cluster0.mmau21i.mongodb.net/work_manage?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB 성공적으로 연결됨!'))
    .catch(err => console.error('MongoDB 연결 에러:', err));

// [MongoDB 스키마(구조) 정의]
const UserSchema = new mongoose.Schema({
    emp_id: { type: String, required: true, unique: true },
    pw: { type: String, required: true },
    name: { type: String, required: true },
    is_admin: { type: Boolean, default: false },
    leave: { type: Number, default: 15.0 },
    profile_img: { type: String, default: null }
});
const User = mongoose.model('User', UserSchema);

const RecordSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    reason: { type: String, required: true },
    start_date: { type: String, required: true },
    end_date: { type: String, required: true }
});
const Record = mongoose.model('Record', RecordSchema);

const SidebarSchema = new mongoose.Schema({
    key: { type: String, default: 'sidebar' },
    name: { type: String, default: '우리팀 복무관리' },
    logo_url: { type: String, default: null }
});
const Sidebar = mongoose.model('Sidebar', SidebarSchema);

// DB 초기화 함수 (최초 1회 실행 시 기본 계정 생성)
async function initDB() {
    try {
        const admin = await User.findOne({ emp_id: '60514' });
        if (!admin) {
            await User.create({ emp_id: '60514', pw: '1111', name: '이재성', is_admin: true, leave: 15.0 });
            await User.create({ emp_id: '1002', pw: '1111', name: '강지혜', is_admin: false, leave: 15.0 });
            await User.create({ emp_id: '1003', pw: '1111', name: '최현진', is_admin: false, leave: 15.0 });
            await User.create({ emp_id: '1004', pw: '1111', name: '서우주', is_admin: false, leave: 15.0 });
            console.log("기본 팀원 계정이 DB에 생성되었습니다.");
        }
        const sidebar = await Sidebar.findOne({ key: 'sidebar' });
        if (!sidebar) {
            await Sidebar.create({ key: 'sidebar', name: '우리팀 복무관리', logo_url: null });
            console.log("사이드바 기본 정보가 DB에 생성되었습니다.");
        }
    } catch (e) {
        console.error("DB 초기화 중 에러:", e);
    }
}
initDB();

const holidays = [
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', 
    '2026-03-01', '2026-03-02', '2026-05-05', '2026-05-24', '2026-05-25', 
    '2026-06-03', '2026-06-06', '2026-08-15', '2026-08-17', 
    '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', '2026-10-05', 
    '2026-10-09', '2026-12-25'
];

function getLeaveDays(startStr, endStr) {
    let start = new Date(startStr);
    let end = new Date(endStr);
    let days = 0;
    let current = new Date(start);
    while (current <= end) {
        let dayOfWeek = current.getDay();
        let dateStr = current.getFullYear() + '-' + String(current.getMonth() + 1).padStart(2, '0') + '-' + String(current.getDate()).padStart(2, '0');
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr)) {
            days += 1;
        }
        current.setDate(current.getDate() + 1);
    }
    return days;
}

app.get('/', async (req, res) => {
    let sidebar_info = await Sidebar.findOne({key: 'sidebar'}).lean() || { name: '우리팀 복무관리', logo_url: null };
    res.render('index', { page: 'login', sidebar_info, user: req.session.user, holidays });
});

app.post('/login', async (req, res) => {
    const { emp_id, emp_pw } = req.body;
    const user = await User.findOne({ emp_id: emp_id, pw: emp_pw }).lean();
    
    if (user) {
        req.session.user = {
            emp_id: user.emp_id,
            name: user.name,
            is_admin: user.is_admin,
            profile_img: user.profile_img
        };
        res.redirect('/main');
    } else {
        res.send("<script>alert('사번이나 비밀번호가 틀렸습니다.'); history.back();</script>");
    }
});

app.post('/api/check_id', async (req, res) => {
    const { emp_id } = req.body;
    const exists = await User.exists({ emp_id: emp_id });
    res.json({ exists: !!exists });
});

app.post('/signup', async (req, res) => {
    const { emp_id, emp_pw, name } = req.body;
    if (await User.exists({ emp_id: emp_id })) {
        return res.send("<script>alert('이미 존재하는 사번입니다.'); history.back();</script>");
    }
    await User.create({ emp_id, pw: emp_pw, name, is_admin: false, leave: 15.0 });
    res.send("<script>alert('회원가입이 완료되었습니다.'); window.location.href='/';</script>");
});

app.post('/admin/create_user', async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    const { emp_id, emp_pw, name } = req.body;
    if (await User.exists({ emp_id: emp_id })) {
        return res.send("<script>alert('이미 존재하는 사번입니다.'); history.back();</script>");
    }
    await User.create({ emp_id, pw: emp_pw, name, is_admin: false, leave: 15.0 });
    res.send("<script>alert('팀원 계정이 성공적으로 생성되었습니다.'); window.location.href='/admin';</script>");
});

app.post('/reset_pw_request', async (req, res) => {
    const { emp_id, name } = req.body;
    const user = await User.findOne({ emp_id, name });
    if (user) {
        user.pw = 'new1234@';
        await user.save();
        return res.send("<script>alert('비밀번호가 [new1234@]로 초기화되었습니다.'); window.location.href='/';</script>");
    }
    res.send("<script>alert('정보가 일치하지 않습니다.'); history.back();</script>");
});

app.post('/update_sidebar', async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    const { team_name, reset_logo, logo_base64 } = req.body;
    
    let updateData = {};
    if (team_name) updateData.name = team_name;
    if (reset_logo === 'yes') updateData.logo_url = null;
    else if (logo_base64) updateData.logo_url = logo_base64;

    await Sidebar.updateOne({ key: 'sidebar' }, { $set: updateData });
    res.redirect(req.get('referer') || '/main');
});

app.post('/update_profile', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { current_pw, new_pw, confirm_pw, reset_profile_img, profile_img_base64 } = req.body;
    
    let user = await User.findOne({ emp_id: req.session.user.emp_id });
    if (!user) return res.redirect('/');

    if (current_pw || new_pw || confirm_pw) {
        if (current_pw !== user.pw) {
            return res.send("<script>alert('기존 비밀번호가 일치하지 않습니다.'); history.back();</script>");
        }
        if (new_pw !== confirm_pw) {
            return res.send("<script>alert('변경 비밀번호를 확인해 주세요.'); history.back();</script>");
        }
        if (new_pw) user.pw = new_pw;
    }

    if (reset_profile_img === 'yes') {
        user.profile_img = null;
        req.session.user.profile_img = null;
    } else if (profile_img_base64) {
        user.profile_img = profile_img_base64;
        req.session.user.profile_img = profile_img_base64;
    }

    await user.save();
    req.session.user.name = user.name;
    res.redirect(req.get('referer') || '/main');
});

app.get('/main', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    let today = new Date();
    let target_date_str = req.query.date || (today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0'));
    
    let targetDateObj = new Date(target_date_str);
    let prevDateObj = new Date(targetDateObj); prevDateObj.setDate(prevDateObj.getDate() - 1);
    let nextDateObj = new Date(targetDateObj); nextDateObj.setDate(nextDateObj.getDate() + 1);
    
    let prev_date = prevDateObj.getFullYear() + '-' + String(prevDateObj.getMonth() + 1).padStart(2, '0') + '-' + String(prevDateObj.getDate()).padStart(2, '0');
    let next_date = nextDateObj.getFullYear() + '-' + String(nextDateObj.getMonth() + 1).padStart(2, '0') + '-' + String(nextDateObj.getDate()).padStart(2, '0');

    let users = await User.find().lean();
    let records = await Record.find().lean();
    let sidebar_info = await Sidebar.findOne({key: 'sidebar'}).lean() || { name: '우리팀 복무관리', logo_url: null };

    let team_status = [];
    let working_cnt = users.length;
    let leave_cnt = 0;
    let trip_cnt = 0;

    for (let u of users) {
        let member = u.name;
        let status = '정상근무';
        let reason = '정상근무';
        let profile_img = u.profile_img;

        for (let r of records) {
            if (r.start_date <= target_date_str && target_date_str <= r.end_date && r.name === member) {
                reason = r.reason;
                if (['연차', '오전반차', '오후반차', '공가', '장기근속휴가', '청원휴가'].includes(reason)) {
                    status = '휴가';
                } else if (reason === '출장') {
                    status = '출장';
                } else {
                    status = reason;
                }
                break;
            }
        }

        team_status.push({ name: member, status, reason, profile_img });
        if (status === '휴가') { working_cnt--; leave_cnt++; }
        else if (status === '출장') { working_cnt--; trip_cnt++; }
    }

    let t_date = new Date(target_date_str);
    let m_year = t_date.getFullYear();
    let m_month = t_date.getMonth(); 
    let firstDay = new Date(m_year, m_month, 1);
    let lastDay = new Date(m_year, m_month + 1, 0);

    let current_month_biz_days = 0;
    let curr = new Date(firstDay);
    while (curr <= lastDay) {
        let dayOfWeek = curr.getDay();
        let dateStr = curr.getFullYear() + '-' + String(curr.getMonth() + 1).padStart(2, '0') + '-' + String(curr.getDate()).padStart(2, '0');
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr)) {
            current_month_biz_days += 1;
        }
        curr.setDate(curr.getDate() + 1);
    }

    let team_members = users.map(u => u.name);

    res.render('index', {
        page: 'main',
        user: req.session.user,
        team_status,
        current_date: target_date_str,
        prev_date,
        next_date,
        working_cnt,
        leave_cnt,
        trip_cnt,
        sidebar_info,
        total_members: team_members.length,
        team_members,
        holidays,
        current_month_biz_days
    });
});

app.get('/calendar', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    let current_date = req.query.date || new Date().toISOString().split('T')[0];
    let users = await User.find().lean();
    let records = await Record.find().lean();
    let sidebar_info = await Sidebar.findOne({key: 'sidebar'}).lean() || { name: '우리팀 복무관리', logo_url: null };
    
    let mergedRecords = [];
    let skipMerge = ['오전반차', '오후반차'];
    let groups = {};

    records.forEach(r => {
        let key = r.name + '_' + r.reason;
        if (skipMerge.includes(r.reason)) key = r.id; 
        if (!groups[key]) groups[key] = [];
        groups[key].push({...r});
    });

    for (let k in groups) {
        let arr = groups[k];
        arr.sort((a,b) => a.start_date.localeCompare(b.start_date));
        
        let current = arr[0];
        let currentIds = [current.id];

        for (let i = 1; i < arr.length; i++) {
            let next = arr[i];
            
            let nextBizD = new Date(current.end_date);
            do {
                nextBizD.setDate(nextBizD.getDate() + 1);
            } while (nextBizD.getDay() === 0 || nextBizD.getDay() === 6 || holidays.includes(nextBizD.getFullYear() + '-' + String(nextBizD.getMonth() + 1).padStart(2, '0') + '-' + String(nextBizD.getDate()).padStart(2, '0')));
            let nextBizStr = nextBizD.getFullYear() + '-' + String(nextBizD.getMonth() + 1).padStart(2, '0') + '-' + String(nextBizD.getDate()).padStart(2, '0');

            let nextDayD = new Date(current.end_date);
            nextDayD.setDate(nextDayD.getDate() + 1);
            let nextDayStr = nextDayD.getFullYear() + '-' + String(nextDayD.getMonth() + 1).padStart(2, '0') + '-' + String(nextDayD.getDate()).padStart(2, '0');

            if (next.start_date <= nextDayStr || next.start_date === nextBizStr || next.start_date <= current.end_date) {
                if (next.end_date > current.end_date) {
                    current.end_date = next.end_date;
                }
                currentIds.push(next.id);
            } else {
                current.id = currentIds.join(',');
                mergedRecords.push(current);
                current = next;
                currentIds = [current.id];
            }
        }
        current.id = currentIds.join(',');
        mergedRecords.push(current);
    }

    let fc_records = mergedRecords.map(r => {
        let endDateObj = new Date(r.end_date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        let endDateFcStr = endDateObj.getFullYear() + '-' + String(endDateObj.getMonth() + 1).padStart(2, '0') + '-' + String(endDateObj.getDate()).padStart(2, '0');
        return {
            id: String(r.id),
            name: r.name,
            reason: r.reason,
            start_date: r.start_date,
            end_date: r.end_date,
            end_date_fc: endDateFcStr
        };
    });

    let team_members = users.map(u => u.name);
    res.render('index', { 
        page: 'calendar', 
        user: req.session.user, 
        records: fc_records, 
        team_members, 
        sidebar_info,
        current_date,
        holidays
    });
});

app.post('/submit', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { member, reason, start_date, end_date, current_calendar_date, record_ids } = req.body;
    
    if (!req.session.user.is_admin && member !== req.session.user.name) {
        return res.send("<script>alert('타인의 복무는 등록/수정할 수 없습니다.'); history.back();</script>");
    }

    if (start_date > end_date) {
        return res.send("<script>alert('종료일이 시작일보다 빠를 수 없어.'); history.back();</script>");
    }

    let editIds = record_ids ? record_ids.split(',').map(id => parseInt(id)) : [];

    let overlapQuery = {
        name: member,
        start_date: { $lte: end_date },
        end_date: { $gte: start_date }
    };
    if (editIds.length > 0) {
        overlapQuery.id = { $nin: editIds };
    }

    let hasOverlap = await Record.exists(overlapQuery);

    if (hasOverlap) {
        return res.send("<script>alert('해당 일자에 등록된 복무가 있습니다.'); history.back();</script>");
    }

    if (editIds.length > 0) {
        await Record.deleteMany({ id: { $in: editIds } });
    }

    let lastRec = await Record.findOne().sort('-id').lean();
    let nextId = lastRec ? lastRec.id + 1 : 1;

    await Record.create({
        id: nextId,
        name: member,
        reason,
        start_date,
        end_date
    });
    
    let dateParam = current_calendar_date ? '?date=' + current_calendar_date : '';
    res.redirect('/calendar' + dateParam);
});

app.get('/delete/:ids', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    let ids = req.params.ids.split(',').map(id => parseInt(id));
    
    if (!req.session.user.is_admin) {
        let recordsToDelete = await Record.find({ id: { $in: ids } }).lean();
        let isForeign = recordsToDelete.some(r => r.name !== req.session.user.name);
        if (isForeign) {
            return res.send("<script>alert('타인의 복무는 취소할 수 없습니다.'); history.back();</script>");
        }
    }

    await Record.deleteMany({ id: { $in: ids } });
    
    let dateParam = req.query.date ? '?date=' + req.query.date : '';
    res.redirect('/calendar' + dateParam);
});

app.get('/leave_status', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    let users = await User.find().lean();
    let records = await Record.find().lean();
    let sidebar_info = await Sidebar.findOne({key: 'sidebar'}).lean() || { name: '우리팀 복무관리', logo_url: null };

    let leave_data = {};
    let monthly_usage = {};
    
    for (let u of users) {
        let eid = u.emp_id;
        monthly_usage[eid] = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 10:0, 11:0, 12:0 };
        leave_data[eid] = {
            eid: eid,
            name: u.name,
            granted: u.leave,
            used: 0,
            remaining: u.leave
        };
    }
    
    records.forEach(r => {
        let userMatch = users.find(u => u.name === r.name);
        if(userMatch) {
            let eid = userMatch.emp_id;
            let days = getLeaveDays(r.start_date, r.end_date);
            if (r.reason === '연차') leave_data[eid].used += 1.0 * days;
            else if (['오전반차', '오후반차'].includes(r.reason)) leave_data[eid].used += 0.5 * days;
            
            if (['연차', '오전반차', '오후반차'].includes(r.reason)) {
                let current = new Date(r.start_date);
                let end = new Date(r.end_date);
                while (current <= end) {
                    let dayOfWeek = current.getDay();
                    let dateStr = current.getFullYear() + '-' + String(current.getMonth() + 1).padStart(2, '0') + '-' + String(current.getDate()).padStart(2, '0');
                    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr)) {
                        let m = current.getMonth() + 1;
                        if (r.reason === '연차') monthly_usage[eid][m] += 1.0;
                        else monthly_usage[eid][m] += 0.5;
                    }
                    current.setDate(current.getDate() + 1);
                }
            }
        }
    });
    
    for (let eid in leave_data) {
        leave_data[eid].remaining = leave_data[eid].granted - leave_data[eid].used;
    }
    
    let leave_data_list = Object.values(leave_data);
    let monthly_data_for_view = [];
    for (let eid in leave_data) {
        monthly_data_for_view.push({
            name: leave_data[eid].name,
            usage: monthly_usage[eid]
        });
    }

    const fixedOrder = ['이재성', '강지혜', '최현진', '서우주'];
    function sortUsers(a, b) {
        let idxA = fixedOrder.indexOf(a.name);
        let idxB = fixedOrder.indexOf(b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
    }
    
    leave_data_list.sort(sortUsers);
    monthly_data_for_view.sort(sortUsers);

    let team_members = users.map(u => u.name);
    res.render('index', { 
        page: 'leave', 
        user: req.session.user, 
        leave_data_list, 
        team_members, 
        sidebar_info, 
        holidays,
        monthly_data_for_view
    });
});

app.post('/update_leave', async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    const { emp_id, granted } = req.body;
    await User.updateOne({ emp_id }, { leave: parseFloat(granted) });
    res.redirect('/leave_status');
});

app.get('/admin', async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.send("<script>alert('관리자만 접근 가능합니다.'); history.back();</script>");
    let users = await User.find().lean();
    let db_users = {};
    users.forEach(u => db_users[u.emp_id] = u);
    let team_members = users.map(u => u.name);
    let sidebar_info = await Sidebar.findOne({key: 'sidebar'}).lean() || { name: '우리팀 복무관리', logo_url: null };

    res.render('index', { page: 'admin', user: req.session.user, users: db_users, team_members, sidebar_info, holidays });
});

app.post('/admin/action', async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    const { action, emp_id, new_pw } = req.body;
    
    if (emp_id === '60514' && action === 'delete') {
        return res.send("<script>alert('최고 관리자는 삭제할 수 없습니다.'); history.back();</script>");
    }
    
    if (action === 'reset') {
        await User.updateOne({ emp_id }, { pw: 'new1234@' });
    } else if (action === 'delete') {
        await User.deleteOne({ emp_id });
    } else if (action === 'change_pw') {
        await User.updateOne({ emp_id }, { pw: new_pw });
    }
    res.redirect('/admin');
});

// [DB 전환용 백업 기능 유지] (필요시 백업용)
app.get('/admin/backup', async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    let users = await User.find({}, '-_id -__v').lean();
    let records = await Record.find({}, '-_id -__v').lean();
    let sidebar = await Sidebar.findOne({key: 'sidebar'}, '-_id -__v').lean() || { name: '우리팀 복무관리', logo_url: null };

    let backupDb = { users: {}, records: records, sidebar_info: sidebar };
    users.forEach(u => {
        backupDb.users[u.emp_id] = { pw: u.pw, name: u.name, is_admin: u.is_admin, leave: u.leave, profile_img: u.profile_img };
    });

    const backupData = JSON.stringify(backupDb, null, 2);
    res.setHeader('Content-disposition', 'attachment; filename=work_manage_backup.json');
    res.setHeader('Content-type', 'application/json');
    res.send(backupData);
});

// [DB 복구] 기존 JSON 백업 데이터를 몽고DB로 밀어넣기
app.post('/admin/restore', async (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    try {
        const backupData = JSON.parse(req.body.backup_data);
        if (backupData && backupData.users && backupData.records) {
            
            // 1. 기존 DB 클리어
            await User.deleteMany({});
            await Record.deleteMany({});
            await Sidebar.deleteMany({});

            // 2. 유저 데이터 복원
            for (let eid in backupData.users) {
                let u = backupData.users[eid];
                await User.create({ emp_id: eid, pw: u.pw, name: u.name, is_admin: u.is_admin, leave: u.leave, profile_img: u.profile_img });
            }

            // 3. 기록 복원
            if (backupData.records.length > 0) {
                await Record.insertMany(backupData.records);
            }

            // 4. 사이드바 복원
            let sb = backupData.sidebar_info || { name: '우리팀 복무관리', logo_url: null };
            await Sidebar.create({ key: 'sidebar', name: sb.name, logo_url: sb.logo_url });
            
            return res.send("<script>alert('데이터가 몽고DB로 성공적으로 마이그레이션/복구되었습니다.'); window.location.href='/admin';</script>");
        } else {
            return res.send("<script>alert('유효하지 않은 백업 파일입니다.'); history.back();</script>");
        }
    } catch (e) {
        console.error("복구 에러:", e);
        return res.send("<script>alert('파일을 읽거나 처리하는 중 오류가 발생했습니다.'); history.back();</script>");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.listen(5000, '0.0.0.0', () => {
    console.log('Node.js server running on port 5000');
});
