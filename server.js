const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

let db = {
    'users': {
        '60514': {'pw': '1111', 'name': '이재성', 'is_admin': true, 'leave': 15.0, 'profile_img': null},
        '1002': {'pw': '1111', 'name': '강지혜', 'is_admin': false, 'leave': 15.0, 'profile_img': null},
        '1003': {'pw': '1111', 'name': '최현진', 'is_admin': false, 'leave': 15.0, 'profile_img': null},
        '1004': {'pw': '1111', 'name': '서우주', 'is_admin': false, 'leave': 15.0, 'profile_img': null},
    },
    'records': []
};
let record_id_counter = 1;

let sidebar_info = {
    'name': '우리팀 복무관리',
    'logo_url': null
};

let currentUser = null;

function getLeaveDays(startStr, endStr) {
    let start = new Date(startStr);
    let end = new Date(endStr);
    let days = 0;
    let current = new Date(start);
    while (current <= end) {
        let dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            days += 1;
        }
        current.setDate(current.getDate() + 1);
    }
    return days;
}

app.get('/', (req, res) => {
    res.render('index', { page: 'login', sidebar_info, user: currentUser });
});

app.post('/login', (req, res) => {
    const { emp_id, emp_pw } = req.body;
    if (db.users[emp_id] && db.users[emp_id].pw === emp_pw) {
        currentUser = {
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

app.post('/reset_pw_request', (req, res) => {
    const { emp_id, name } = req.body;
    if (db.users[emp_id] && db.users[emp_id].name === name) {
        db.users[emp_id].pw = 'new1234@';
        return res.send("<script>alert('비밀번호가 [new1234@]로 초기화되었습니다.'); window.location.href='/';</script>");
    }
    res.send("<script>alert('정보가 일치하지 않습니다.'); history.back();</script>");
});

app.post('/update_sidebar', (req, res) => {
    if (!currentUser || !currentUser.is_admin) return res.status(403).send("권한이 없어.");
    const { team_name, reset_logo, logo_base64 } = req.body;
    if (team_name) sidebar_info.name = team_name;
    
    if (reset_logo === 'yes') {
        sidebar_info.logo_url = null;
    } else if (logo_base64) {
        sidebar_info.logo_url = logo_base64;
    }
    res.redirect(req.get('referer') || '/main');
});

app.post('/update_profile', (req, res) => {
    if (!currentUser) return res.redirect('/');
    let user_db = db.users[currentUser.emp_id];
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
        currentUser.profile_img = null;
    } else if (profile_img_base64) {
        user_db.profile_img = profile_img_base64;
        currentUser.profile_img = profile_img_base64;
    }

    currentUser.name = user_db.name;
    res.redirect(req.get('referer') || '/main');
});

app.get('/main', (req, res) => {
    if (!currentUser) return res.redirect('/');
    
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
        user: currentUser,
        team_status,
        current_date: target_date_str,
        prev_date,
        next_date,
        working_cnt,
        leave_cnt,
        trip_cnt,
        sidebar_info,
        total_members: team_members.length,
        team_members
    });
});

app.get('/calendar', (req, res) => {
    if (!currentUser) return res.redirect('/');
    let fc_records = db.records.map(r => {
        let endDateObj = new Date(r.end_date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        return {
            id: r.id,
            name: r.name,
            reason: r.reason,
            start_date: r.start_date,
            end_date_fc: endDateObj.toISOString().split('T')[0]
        };
    });
    let team_members = Object.values(db.users).map(u => u.name);
    res.render('index', { page: 'calendar', user: currentUser, records: fc_records, team_members, sidebar_info });
});

app.post('/submit', (req, res) => {
    if (!currentUser) return res.redirect('/');
    const { member, reason, start_date, end_date } = req.body;
    if (start_date > end_date) {
        return res.send("<script>alert('종료일이 시작일보다 빠를 수 없어.'); history.back();</script>");
    }
    db.records.push({
        id: record_id_counter++,
        name: member,
        reason,
        start_date,
        end_date
    });
    res.redirect('/calendar');
});

app.get('/delete/:id', (req, res) => {
    if (!currentUser) return res.redirect('/');
    let id = parseInt(req.params.id);
    db.records = db.records.filter(r => r.id !== id);
    res.redirect('/calendar');
});

app.get('/leave_status', (req, res) => {
    if (!currentUser) return res.redirect('/');
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
    res.render('index', { page: 'leave', user: currentUser, leave_data, team_members, sidebar_info });
});

app.post('/update_leave', (req, res) => {
    if (!currentUser || !currentUser.is_admin) return res.status(403).send("권한이 없어.");
    const { emp_id, granted } = req.body;
    if (db.users[emp_id]) {
        db.users[emp_id].leave = parseFloat(granted);
    }
    res.redirect('/leave_status');
});

app.get('/admin', (req, res) => {
    if (!currentUser || !currentUser.is_admin) return res.send("<script>alert('관리자만 접근 가능합니다.'); history.back();</script>");
    let team_members = Object.values(db.users).map(u => u.name);
    res.render('index', { page: 'admin', user: currentUser, users: db.users, team_members, sidebar_info });
});

app.post('/admin/action', (req, res) => {
    if (!currentUser || !currentUser.is_admin) return res.status(403).send("권한이 없어.");
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

// 데이터 백업 (JSON 파일 다운로드)
app.get('/admin/backup', (req, res) => {
    if (!currentUser || !currentUser.is_admin) return res.status(403).send("권한이 없어.");
    const backupData = JSON.stringify(db, null, 2);
    res.setHeader('Content-disposition', 'attachment; filename=work_manage_backup.json');
    res.setHeader('Content-type', 'application/json');
    res.send(backupData);
});

// 데이터 복구 (JSON 데이터 업로드 및 덮어쓰기)
app.post('/admin/restore', (req, res) => {
    if (!currentUser || !currentUser.is_admin) return res.status(403).send("권한이 없어.");
    try {
        const backupData = JSON.parse(req.body.backup_data);
        if (backupData && backupData.users && backupData.records) {
            db = backupData;
            
            // 기록 ID 카운터 갱신 (가장 높은 ID + 1)
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
    currentUser = null;
    res.redirect('/');
});

app.listen(5000, '0.0.0.0', () => {
    console.log('Node.js server running on port 5000');
});
