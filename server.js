const express = require('express');
const session = require('express-session');
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

let db = {
    'users': {
        '60514': {'pw': '1111', 'name': '이재성', 'is_admin': true, 'leave': 15.0, 'profile_img': null},
        '1002': {'pw': '1111', 'name': '강지혜', 'is_admin': false, 'leave': 15.0, 'profile_img': null},
        '1003': {'pw': '1111', 'name': '최현진', 'is_admin': false, 'leave': 15.0, 'profile_img': null},
        '1004': {'pw': '1111', 'name': '서우주', 'is_admin': false, 'leave': 15.0, 'profile_img': null},
    },
    'records': [],
    'sidebar_info': {
        'name': '우리팀 복무관리',
        'logo_url': null
    }
};
let record_id_counter = 1;

// 2026년 기준 공휴일 배열 (서버 및 클라이언트 모두 사용)
const holidays = [
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', 
    '2026-03-01', '2026-03-02', '2026-05-05', '2026-05-24', 
    '2026-05-25', '2026-06-06', '2026-08-15', '2026-08-17', 
    '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', 
    '2026-10-09', '2026-12-25'
];

function getLeaveDays(startStr, endStr) {
    let start = new Date(startStr);
    let end = new Date(endStr);
    let days = 0;
    let current = new Date(start);
    while (current <= end) {
        let dayOfWeek = current.getDay();
        let dateStr = current.toISOString().split('T')[0];
        // 주말(0,6) 및 공휴일 제외하고 평일 영업일만 카운트
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr)) {
            days += 1;
        }
        current.setDate(current.getDate() + 1);
    }
    return days;
}

app.get('/', (req, res) => {
    res.render('index', { page: 'login', sidebar_info: db.sidebar_info, user: req.session.user, holidays });
});

app.post('/login', (req, res) => {
    const { emp_id, emp_pw } = req.body;
    if (db.users[emp_id] && db.users[emp_id].pw === emp_pw) {
        req.session.user = {
            emp_id: emp_id,
            name: db.users[emp_id].name,
            is_admin: db.users[emp_id].is_admin,
            profile_img: db.users[emp_id].profile_img
        };
        res.redirect('/main');
    } else {
        res.send("<script>alert('사번이나 비밀번호가 틀렸습니다.'); history.back();</script>");
    }
});

app.post('/api/check_id', (req, res) => {
    const { emp_id } = req.body;
    const exists = !!db.users[emp_id];
    res.json({ exists });
});

app.post('/signup', (req, res) => {
    const { emp_id, emp_pw, name } = req.body;
    if (db.users[emp_id]) {
        return res.send("<script>alert('이미 존재하는 사번입니다.'); history.back();</script>");
    }
    db.users[emp_id] = { pw: emp_pw, name: name, is_admin: false, leave: 15.0, profile_img: null };
    res.send("<script>alert('회원가입이 완료되었습니다.'); window.location.href='/';</script>");
});

app.post('/admin/create_user', (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    const { emp_id, emp_pw, name } = req.body;
    if (db.users[emp_id]) {
        return res.send("<script>alert('이미 존재하는 사번입니다.'); history.back();</script>");
    }
    db.users[emp_id] = { pw: emp_pw, name: name, is_admin: false, leave: 15.0, profile_img: null };
    res.send("<script>alert('팀원 계정이 성공적으로 생성되었습니다.'); window.location.href='/admin';</script>");
});

app.post('/reset_pw_request', (req, res) => {
    const { emp_id, name } = req.body;
    if (db.users[emp_id] && db.users[emp_id].name === name) {
        db.users[emp_id].pw = 'new1234@';
        return res.send("<script>alert('비밀번호가 [new1234@]로 초기화되었습니다.'); window.location.href='/';</script>");
    }
    res.send("<script>alert('정보가 일치하지 않습니다.'); history.back();</script>");
});

app.post('/update_sidebar', (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    const { team_name, reset_logo, logo_base64 } = req.body;
    if (team_name) db.sidebar_info.name = team_name;
    
    if (reset_logo === 'yes') {
        db.sidebar_info.logo_url = null;
    } else if (logo_base64) {
        db.sidebar_info.logo_url = logo_base64;
    }
    res.redirect(req.get('referer') || '/main');
});

app.post('/update_profile', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    let user_db = db.users[req.session.user.emp_id];
    const { current_pw, new_pw, confirm_pw, reset_profile_img, profile_img_base64 } = req.body;

    if (current_pw || new_pw || confirm_pw) {
        if (current_pw !== user_db.pw) {
            return res.send("<script>alert('기존 비밀번호가 일치하지 않습니다.'); history.back();</script>");
        }
        if (new_pw !== confirm_pw) {
            return res.send("<script>alert('변경 비밀번호를 확인해 주세요.'); history.back();</script>");
        }
        if (new_pw) {
            user_db.pw = new_pw;
        }
    }

    if (reset_profile_img === 'yes') {
        user_db.profile_img = null;
        req.session.user.profile_img = null;
    } else if (profile_img_base64) {
        user_db.profile_img = profile_img_base64;
        req.session.user.profile_img = profile_img_base64;
    }

    req.session.user.name = user_db.name;
    res.redirect(req.get('referer') || '/main');
});

app.get('/main', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    let today = new Date();
    let target_date_str = req.query.date || today.toISOString().split('T')[0];
    
    let targetDateObj = new Date(target_date_str);
    let prevDateObj = new Date(targetDateObj); prevDateObj.setDate(prevDateObj.getDate() - 1);
    let nextDateObj = new Date(targetDateObj); nextDateObj.setDate(nextDateObj.getDate() + 1);
    
    let prev_date = prevDateObj.toISOString().split('T')[0];
    let next_date = nextDateObj.toISOString().split('T')[0];

    let team_status = [];
    let working_cnt = Object.keys(db.users).length;
    let leave_cnt = 0;
    let trip_cnt = 0;

    for (let eid in db.users) {
        let u = db.users[eid];
        let member = u.name;
        let status = '정상근무';
        let reason = '정상근무';
        let profile_img = u.profile_img;

        for (let r of db.records) {
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

    let team_members = Object.values(db.users).map(u => u.name);

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
        sidebar_info: db.sidebar_info,
        total_members: team_members.length,
        team_members,
        holidays
    });
});

app.get('/calendar', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    let current_date = req.query.date || new Date().toISOString().split('T')[0];
    let mergedRecords = [];
    let skipMerge = ['오전반차', '오후반차'];
    let groups = {};

    // 1. 사람 & 사유별로 그룹화
    db.records.forEach(r => {
        let key = r.name + '_' + r.reason;
        // 반차는 무조건 개별 기록 유지
        if (skipMerge.includes(r.reason)) key = r.id; 
        if (!groups[key]) groups[key] = [];
        groups[key].push({...r});
    });

    // 2. 그룹 내에서 연속된 날짜 병합
    for (let k in groups) {
        let arr = groups[k];
        arr.sort((a,b) => a.start_date.localeCompare(b.start_date));
        
        let current = arr[0];
        let currentIds = [current.id];

        for (let i = 1; i < arr.length; i++) {
            let next = arr[i];
            
            // 현재 종료일 다음 영업일 계산
            let nextBizD = new Date(current.end_date);
            do {
                nextBizD.setDate(nextBizD.getDate() + 1);
            } while (nextBizD.getDay() === 0 || nextBizD.getDay() === 6 || holidays.includes(nextBizD.toISOString().split('T')[0]));
            let nextBizStr = nextBizD.toISOString().split('T')[0];

            // 현재 종료일 단순 다음 날
            let nextDayD = new Date(current.end_date);
            nextDayD.setDate(nextDayD.getDate() + 1);
            let nextDayStr = nextDayD.toISOString().split('T')[0];

            // 이어지는 휴가라면 병합
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
        return {
            id: String(r.id),
            name: r.name,
            reason: r.reason,
            start_date: r.start_date,
            end_date_fc: endDateObj.toISOString().split('T')[0]
        };
    });

    let team_members = Object.values(db.users).map(u => u.name);
    res.render('index', { 
        page: 'calendar', 
        user: req.session.user, 
        records: fc_records, 
        team_members, 
        sidebar_info: db.sidebar_info,
        current_date,
        holidays
    });
});

app.post('/submit', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { member, reason, start_date, end_date, current_calendar_date } = req.body;
    
    // [V9] 일반 직원은 다른 사람의 복무를 등록할 수 없음
    if (!req.session.user.is_admin && member !== req.session.user.name) {
        return res.send("<script>alert('타인의 복무는 등록/수정할 수 없습니다.'); history.back();</script>");
    }

    if (start_date > end_date) {
        return res.send("<script>alert('종료일이 시작일보다 빠를 수 없어.'); history.back();</script>");
    }

    // [V9] 중복된 날짜 검증
    let hasOverlap = db.records.some(r => {
        return r.name === member && (start_date <= r.end_date && end_date >= r.start_date);
    });

    if (hasOverlap) {
        return res.send("<script>alert('해당 일자에 등록된 복무가 있습니다.'); history.back();</script>");
    }

    db.records.push({
        id: record_id_counter++,
        name: member,
        reason,
        start_date,
        end_date
    });
    
    let dateParam = current_calendar_date ? '?date=' + current_calendar_date : '';
    res.redirect('/calendar' + dateParam);
});

app.get('/delete/:ids', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    let ids = req.params.ids.split(',').map(id => parseInt(id));
    let recordsToDelete = db.records.filter(r => ids.includes(r.id));
    
    // [V9] 관리자가 아니면 타인의 복무를 삭제할 수 없음
    if (!req.session.user.is_admin) {
        let isForeign = recordsToDelete.some(r => r.name !== req.session.user.name);
        if (isForeign) {
            return res.send("<script>alert('타인의 복무는 취소할 수 없습니다.'); history.back();</script>");
        }
    }

    db.records = db.records.filter(r => !ids.includes(r.id));
    
    let dateParam = req.query.date ? '?date=' + req.query.date : '';
    res.redirect('/calendar' + dateParam);
});

app.get('/leave_status', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    let leave_data = {};
    for (let eid in db.users) {
        let u = db.users[eid];
        let used = 0.0;
        db.records.forEach(r => {
            if (r.name === u.name) {
                let days = getLeaveDays(r.start_date, r.end_date);
                if (r.reason === '연차') used += 1.0 * days;
                else if (['오전반차', '오후반차'].includes(r.reason)) used += 0.5 * days;
            }
        });
        leave_data[eid] = {
            name: u.name,
            granted: u.leave,
            used: used,
            remaining: u.leave - used
        };
    }
    let team_members = Object.values(db.users).map(u => u.name);
    res.render('index', { page: 'leave', user: req.session.user, leave_data, team_members, sidebar_info: db.sidebar_info, holidays });
});

app.post('/update_leave', (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    const { emp_id, granted } = req.body;
    if (db.users[emp_id]) {
        db.users[emp_id].leave = parseFloat(granted);
    }
    res.redirect('/leave_status');
});

app.get('/admin', (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.send("<script>alert('관리자만 접근 가능합니다.'); history.back();</script>");
    let team_members = Object.values(db.users).map(u => u.name);
    res.render('index', { page: 'admin', user: req.session.user, users: db.users, team_members, sidebar_info: db.sidebar_info, holidays });
});

app.post('/admin/action', (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    const { action, emp_id, new_pw } = req.body;
    if (emp_id === '60514' && action === 'delete') {
        return res.send("<script>alert('최고 관리자는 삭제할 수 없습니다.'); history.back();</script>");
    }
    if (action === 'reset') {
        db.users[emp_id].pw = 'new1234@';
    } else if (action === 'delete') {
        delete db.users[emp_id];
    } else if (action === 'change_pw') {
        db.users[emp_id].pw = new_pw;
    }
    res.redirect('/admin');
});

app.get('/admin/backup', (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    const backupData = JSON.stringify(db, null, 2);
    res.setHeader('Content-disposition', 'attachment; filename=work_manage_backup.json');
    res.setHeader('Content-type', 'application/json');
    res.send(backupData);
});

app.post('/admin/restore', (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) return res.status(403).send("권한이 없어.");
    try {
        const backupData = JSON.parse(req.body.backup_data);
        if (backupData && backupData.users && backupData.records) {
            db = backupData;
            
            if(!db.sidebar_info) {
                db.sidebar_info = { name: '우리팀 복무관리', logo_url: null };
            }
            
            let maxId = 0;
            db.records.forEach(r => {
                if (r.id > maxId) maxId = r.id;
            });
            record_id_counter = maxId + 1;
            
            return res.send("<script>alert('데이터가 성공적으로 복구되었습니다.'); window.location.href='/admin';</script>");
        } else {
            return res.send("<script>alert('유효하지 않은 백업 파일입니다.'); history.back();</script>");
        }
    } catch (e) {
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
