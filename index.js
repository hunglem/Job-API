const crypto = require('crypto');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
const tokenSecret = process.env.TOKEN_SECRET || 'job-api-dev-secret';
const tokenTtlSeconds = 3600;

app.use(express.json());

const users = [
  {
    id: 1,
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin',
    status: 'active',
    created_at: '2026-06-01',
  },
  {
    id: 2,
    name: 'Recruiter User',
    email: 'recruiter@example.com',
    password: 'password123',
    role: 'recruiter',
    status: 'active',
    created_at: '2026-06-01',
  },
  {
    id: 3,
    name: 'Candidate User',
    email: 'candidate@example.com',
    password: 'password123',
    role: 'candidate',
    status: 'active',
    created_at: '2026-06-01',
  },
];

const jobs = [
  {
    id: 1,
    title: 'PHP Developer',
    description: 'Build and maintain Laravel APIs.',
    salary_min: 1000,
    salary_max: 2000,
    location: 'Remote',
    status: 'active',
    recruiter_id: 2,
    created_at: '2026-06-01',
  },
];

const applications = [];

let nextUserId = 4;
let nextJobId = 2;
let nextApplicationId = 1;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function success(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function error(res, status, message, errors) {
  const body = { success: false, message };

  if (errors) {
    body.errors = errors;
  }

  return res.status(status).json(body);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function signToken(payload) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
  };
  const encodedBody = Buffer.from(JSON.stringify(body)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', tokenSecret)
    .update(encodedBody)
    .digest('base64url');

  return `${encodedBody}.${signature}`;
}

function verifyToken(token) {
  const [encodedBody, signature] = String(token || '').split('.');

  if (!encodedBody || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', tokenSecret)
    .update(encodedBody)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8'));

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function authRequired(req, res, next) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return error(res, 401, 'Unauthorized');
  }

  try {
    const payload = verifyToken(token);
    const user = payload && users.find((item) => item.id === payload.user_id);

    if (!user) {
      return error(res, 401, 'Unauthorized');
    }

    req.user = user;
    return next();
  } catch (err) {
    return error(res, 401, 'Unauthorized');
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return error(res, 403, 'Forbidden');
    }

    return next();
  };
}

function paginate(items, req, defaultPerPage = 20) {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const perPage = Math.max(Number.parseInt(req.query.per_page, 10) || defaultPerPage, 1);
  const total = items.length;
  const lastPage = Math.max(Math.ceil(total / perPage), 1);
  const start = (page - 1) * perPage;

  return {
    items: items.slice(start, start + perPage),
    pagination: {
      page,
      per_page: perPage,
      total,
      last_page: lastPage,
    },
  };
}

function requireFields(body, fields) {
  return fields.reduce((errors, field) => {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors[field] = `${field} is required`;
    }

    return errors;
  }, {});
}

function parseMoney(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}



app.post('/api/v1/auth/login', (req, res) => {
  const errors = requireFields(req.body, ['email', 'password']);

  if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
    errors.email = 'email must be a valid email address';
  }

  if (Object.keys(errors).length > 0) {
    return error(res, 422, 'Validation Error', errors);
  }

  const user = users.find(
    (item) => item.email === req.body.email && item.password === req.body.password,
  );

  if (!user) {
    return error(res, 401, 'Unauthorized');
  }

  return success(res, {
    token: signToken({ user_id: user.id }),
    token_type: 'Bearer',
    expires_in: tokenTtlSeconds,
    user: publicUser(user),
  });
});

app.get('/api/v1/users', authRequired, (req, res) => {
  let filteredUsers = users;
  const keyword = String(req.query.keyword || '').trim().toLowerCase();
  const role = String(req.query.role || '').trim();

  if (keyword) {
    filteredUsers = filteredUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword),
    );
  }

  if (role) {
    filteredUsers = filteredUsers.filter((user) => user.role === role);
  }

  const data = paginate(
    filteredUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
    })),
    req,
  );

  return success(res, data);
});

app.post('/api/v1/users', authRequired, requireRole(['admin']), (req, res) => {
  const errors = requireFields(req.body, ['name', 'email', 'password', 'role']);
  const allowedRoles = ['admin', 'recruiter', 'candidate'];

  if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
    errors.email = 'email must be a valid email address';
  }

  if (req.body.email && users.some((user) => user.email === req.body.email)) {
    errors.email = 'email already exists';
  }

  if (req.body.role && !allowedRoles.includes(req.body.role)) {
    errors.role = 'role must be admin, recruiter, or candidate';
  }

  if (Object.keys(errors).length > 0) {
    return error(res, 422, 'Validation Error', errors);
  }

  const user = {
    id: nextUserId++,
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role: req.body.role,
    status: 'active',
    created_at: today(),
  };

  users.push(user);
  return success(res, { id: user.id }, 201);
});

app.get('/api/v1/jobs', (req, res) => {
  let filteredJobs = jobs;
  const keyword = String(req.query.keyword || '').trim().toLowerCase();
  const status = String(req.query.status || '').trim();

  if (keyword) {
    filteredJobs = filteredJobs.filter(
      (job) =>
        job.title.toLowerCase().includes(keyword) ||
        job.description.toLowerCase().includes(keyword) ||
        job.location.toLowerCase().includes(keyword),
    );
  }

  if (status) {
    filteredJobs = filteredJobs.filter((job) => job.status === status);
  }

  const data = paginate(
    filteredJobs.map((job) => ({
      id: job.id,
      title: job.title,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      location: job.location,
      status: job.status,
      created_at: job.created_at,
    })),
    req,
  );

  return success(res, data);
});

app.post('/api/v1/jobs', authRequired, requireRole(['recruiter', 'admin']), (req, res) => {
  const errors = requireFields(req.body, ['title', 'description']);
  const salaryMin = parseMoney(req.body.salary_min);
  const salaryMax = parseMoney(req.body.salary_max);

  if (Number.isNaN(salaryMin)) {
    errors.salary_min = 'salary_min must be a number';
  }

  if (Number.isNaN(salaryMax)) {
    errors.salary_max = 'salary_max must be a number';
  }

  if (
    !Number.isNaN(salaryMin) &&
    !Number.isNaN(salaryMax) &&
    salaryMin !== null &&
    salaryMax !== null &&
    salaryMin > salaryMax
  ) {
    errors.salary = 'salary_min must be less than or equal to salary_max';
  }

  if (Object.keys(errors).length > 0) {
    return error(res, 422, 'Validation Error', errors);
  }

  const job = {
    id: nextJobId++,
    title: req.body.title,
    description: req.body.description,
    salary_min: salaryMin,
    salary_max: salaryMax,
    location: req.body.location || null,
    status: req.body.status || 'active',
    recruiter_id: req.user.id,
    created_at: today(),
  };

  jobs.push(job);
  return success(res, { id: job.id }, 201);
});

app.post(
  '/api/v1/jobs/:id/apply',
  authRequired,
  requireRole(['candidate']),
  (req, res) => {
    const errors = requireFields(req.body, ['resume_id']);
    const jobId = Number.parseInt(req.params.id, 10);
    const job = jobs.find((item) => item.id === jobId);

    if (!job) {
      return error(res, 404, 'Not Found');
    }

    if (Object.keys(errors).length > 0) {
      return error(res, 422, 'Validation Error', errors);
    }

    const duplicateApplication = applications.find(
      (application) => application.job_id === jobId && application.candidate_id === req.user.id,
    );

    if (duplicateApplication) {
      return error(res, 422, 'Validation Error', {
        job_id: 'candidate has already applied to this job',
      });
    }

    const application = {
      id: nextApplicationId++,
      job_id: jobId,
      candidate_id: req.user.id,
      resume_id: req.body.resume_id,
      cover_letter: req.body.cover_letter || null,
      status: 'submitted',
      created_at: today(),
    };

    applications.push(application);
    return success(
      res,
      {
        application_id: application.id,
        status: application.status,
      },
      201,
    );
  },
);

app.get('/api/v1/applications', authRequired, (req, res) => {
  let visibleApplications = applications;
  const status = String(req.query.status || '').trim();

  if (req.user.role === 'candidate') {
    visibleApplications = visibleApplications.filter(
      (application) => application.candidate_id === req.user.id,
    );
  }

  if (req.user.role === 'recruiter') {
    const recruiterJobIds = jobs
      .filter((job) => job.recruiter_id === req.user.id)
      .map((job) => job.id);

    visibleApplications = visibleApplications.filter((application) =>
      recruiterJobIds.includes(application.job_id),
    );
  }

  if (status) {
    visibleApplications = visibleApplications.filter(
      (application) => application.status === status,
    );
  }

  const data = paginate(
    visibleApplications.map((application) => {
      const job = jobs.find((item) => item.id === application.job_id);
      const candidate = users.find((item) => item.id === application.candidate_id);

      return {
        id: application.id,
        job_id: application.job_id,
        job_title: job ? job.title : null,
        candidate_id: application.candidate_id,
        candidate_name: candidate ? candidate.name : null,
        status: application.status,
        created_at: application.created_at,
      };
    }),
    req,
  );

  return success(res, data);
});

app.use((req, res) => {
  error(res, 404, 'Not Found');
});

app.use((err, req, res, next) => {
  console.error(err);
  error(res, 500, 'Internal Server Error');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
