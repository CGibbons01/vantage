import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';
import { createBearerAuth } from '../auth-utils.js';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  requirements: string[];
  postedDate: string;
  type: 'full-time' | 'part-time' | 'contract' | 'remote';
  category: string;
  applyUrl: string;
}

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created: string;
  category: { label: string };
}

// Comprehensive mock job dataset
const generateMockJobs = (): Job[] => {
  const now = new Date();
  const jobs: Job[] = [];
  let jobId = 1;

  const getRandomDate = () => {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  };

  // Technology category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Senior Software Engineer - React/Node',
      company: 'TechFlow Solutions',
      location: 'London',
      salary: '£55,000 - £85,000',
      description: 'We are seeking a Senior Software Engineer with expertise in React and Node.js to lead our frontend platform development. This role offers the opportunity to work on cutting-edge technologies and mentor junior developers.',
      requirements: ['5+ years experience', 'React expertise', 'Node.js proficiency', 'System design knowledge', 'Team leadership'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Technology',
      applyUrl: 'https://careers.techflow.com/job-1',
    },
    {
      id: `job-${jobId++}`,
      title: 'Senior Data Scientist - Python/ML',
      company: 'DataVision AI',
      location: 'London',
      salary: '£70,000 - £100,000',
      description: 'Join our AI research team as a Senior Data Scientist. Work on machine learning models, data pipeline architecture, and deploy ML systems to production.',
      requirements: ['Python expertise', 'Machine learning', 'Statistical analysis', 'SQL', 'Cloud platforms (AWS/GCP)'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Technology',
      applyUrl: 'https://careers.datavision.com/job-2',
    },
    {
      id: `job-${jobId++}`,
      title: 'DevOps Engineer - AWS/Kubernetes',
      company: 'CloudFirst Systems',
      location: 'Manchester',
      salary: '£60,000 - £90,000',
      description: 'Build and maintain cloud infrastructure for a rapidly scaling SaaS platform. Experience with Kubernetes, AWS, and CI/CD pipelines required.',
      requirements: ['AWS/Azure experience', 'Kubernetes', 'Docker', 'CI/CD pipelines', 'Infrastructure as Code'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Technology',
      applyUrl: 'https://careers.cloudfirst.com/job-3',
    },
    {
      id: `job-${jobId++}`,
      title: 'Product Manager - SaaS',
      company: 'InnovateSoft',
      location: 'London',
      salary: '£65,000 - £95,000',
      description: 'Drive product strategy and roadmap for our B2B SaaS platform. Collaborate with engineering, design, and customer success teams to deliver features that matter.',
      requirements: ['Product management experience', 'SaaS knowledge', 'User research', 'Data analysis', 'Cross-functional collaboration'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Technology',
      applyUrl: 'https://careers.innovatesoft.com/job-4',
    },
    {
      id: `job-${jobId++}`,
      title: 'UX Designer - Figma',
      company: 'DesignHub',
      location: 'London',
      salary: '£45,000 - £70,000',
      description: 'Create beautiful and intuitive user interfaces for web and mobile applications. Work closely with product and engineering teams in a collaborative environment.',
      requirements: ['Figma expertise', 'UI/UX design', 'User research', 'Design systems', 'Prototyping'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Technology',
      applyUrl: 'https://careers.designhub.com/job-5',
    },
    {
      id: `job-${jobId++}`,
      title: 'Cybersecurity Analyst',
      company: 'SecureNet Ltd',
      location: 'London',
      salary: '£50,000 - £75,000',
      description: 'Protect our infrastructure from cyber threats. Monitor security events, conduct penetration testing, and implement security best practices.',
      requirements: ['Security certifications (CISSP/CompTIA)', 'Penetration testing', 'Network security', 'Incident response', 'Vulnerability assessment'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Technology',
      applyUrl: 'https://careers.securenet.com/job-6',
    },
    {
      id: `job-${jobId++}`,
      title: 'Full Stack Developer',
      company: 'WebStack Pro',
      location: 'Remote',
      salary: '£50,000 - £80,000',
      description: 'Build web applications from frontend to backend. Work with modern web technologies and contribute to our open-source initiatives.',
      requirements: ['JavaScript/TypeScript', 'React/Vue.js', 'Node.js/Python', 'SQL databases', 'Git'],
      postedDate: getRandomDate(),
      type: 'remote',
      category: 'Technology',
      applyUrl: 'https://careers.webstack.com/job-7',
    },
    {
      id: `job-${jobId++}`,
      title: 'Machine Learning Engineer',
      company: 'AI Ventures',
      location: 'London',
      salary: '£75,000 - £110,000',
      description: 'Develop and optimize machine learning models for production systems. Work on large-scale data processing and model deployment.',
      requirements: ['Python', 'TensorFlow/PyTorch', 'ML algorithms', 'Big data technologies', 'Model deployment'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Technology',
      applyUrl: 'https://careers.aiventures.com/job-8',
    },
    {
      id: `job-${jobId++}`,
      title: 'Cloud Architect - AWS/Azure',
      company: 'Enterprise Cloud',
      location: 'London',
      salary: '£90,000 - £130,000',
      description: 'Design and implement cloud solutions for enterprise clients. Expertise in AWS and Azure required.',
      requirements: ['AWS/Azure expertise', 'Solution architecture', 'Security best practices', 'Cost optimization', 'Enterprise integration'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Technology',
      applyUrl: 'https://careers.enterprisecloud.com/job-9',
    },
    {
      id: `job-${jobId++}`,
      title: 'Mobile Developer - iOS/Android',
      company: 'MobileFirst App Studio',
      location: 'London',
      salary: '£55,000 - £85,000',
      description: 'Develop native iOS and Android applications. Work with cross-functional teams to deliver high-quality mobile experiences.',
      requirements: ['iOS/Swift and Android/Kotlin', 'Mobile UI design', 'API integration', 'Version control', 'Agile methodologies'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Technology',
      applyUrl: 'https://careers.mobilefirst.com/job-10',
    }
  );

  // Healthcare category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'NHS Doctor/GP',
      company: 'NHS England',
      location: 'Various',
      salary: '£60,000 - £90,000',
      description: 'Provide general medical care to patients. Work in primary care settings and manage chronic diseases.',
      requirements: ['Medical degree (MBBS/MD)', 'GMC registration', 'GP training', 'Clinical experience', 'Patient communication'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Healthcare',
      applyUrl: 'https://careers.nhs.uk/job-11',
    },
    {
      id: `job-${jobId++}`,
      title: 'Registered Nurse',
      company: 'Royal Hospital NHS Trust',
      location: 'London',
      salary: '£28,000 - £40,000',
      description: 'Provide direct patient care in hospital wards. Work with diverse patient populations and support senior nurses.',
      requirements: ['Nursing degree (BSc)', 'NMC registration', 'Clinical skills', 'Patient care', 'Team work'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Healthcare',
      applyUrl: 'https://careers.royalhospital.com/job-12',
    },
    {
      id: `job-${jobId++}`,
      title: 'Clinical Pharmacist',
      company: 'City Health Centre',
      location: 'Manchester',
      salary: '£45,000 - £60,000',
      description: 'Optimize medication therapy and educate patients about their medications. Work in clinical settings.',
      requirements: ['Pharmacy degree', 'GPhC registration', 'Clinical knowledge', 'Patient counseling', 'Medication management'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Healthcare',
      applyUrl: 'https://careers.cityhealthcentre.com/job-13',
    },
    {
      id: `job-${jobId++}`,
      title: 'Physiotherapist',
      company: 'Wellness Physio Clinic',
      location: 'Birmingham',
      salary: '£30,000 - £45,000',
      description: 'Assess and treat patients with physical injuries and disabilities. Develop rehabilitation programs.',
      requirements: ['Physiotherapy degree', 'RCCP registration', 'Rehabilitation knowledge', 'Patient motivation', 'Clinical assessment'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Healthcare',
      applyUrl: 'https://careers.wellnessphysio.com/job-14',
    },
    {
      id: `job-${jobId++}`,
      title: 'Mental Health Counsellor',
      company: 'Mind Mental Health Services',
      location: 'London',
      salary: '£35,000 - £50,000',
      description: 'Provide counseling and psychotherapy services to patients with mental health conditions.',
      requirements: ['Counseling qualification', 'Therapy certification', 'Psychology knowledge', 'Empathy', 'Client confidentiality'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Healthcare',
      applyUrl: 'https://careers.mindservices.com/job-15',
    }
  );

  // Finance category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Financial Analyst',
      company: 'FinanceFirst Ltd',
      location: 'London',
      salary: '£45,000 - £65,000',
      description: 'Analyze financial data and create reports. Prepare forecasts and support business decision-making.',
      requirements: ['Accounting knowledge', 'Excel expertise', 'Financial modeling', 'Analysis skills', 'Report writing'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Finance',
      applyUrl: 'https://careers.financefirst.com/job-16',
    },
    {
      id: `job-${jobId++}`,
      title: 'Chartered Accountant',
      company: 'Big 4 Accounting Firm',
      location: 'London',
      salary: '£50,000 - £75,000',
      description: 'Provide audit and assurance services to corporate clients. Manage complex financial engagements.',
      requirements: ['CA/ACCA qualification', 'Audit experience', 'Financial reporting', 'Client management', 'Technical expertise'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Finance',
      applyUrl: 'https://careers.big4.com/job-17',
    },
    {
      id: `job-${jobId++}`,
      title: 'Investment Banker',
      company: 'Goldman Sachs',
      location: 'London',
      salary: '£80,000 - £150,000',
      description: 'Advise corporate clients on mergers and acquisitions. Manage complex investment transactions.',
      requirements: ['Finance degree', 'Investment banking experience', 'Deal experience', 'Valuation skills', 'Client relations'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Finance',
      applyUrl: 'https://careers.goldmansachs.com/job-18',
    },
    {
      id: `job-${jobId++}`,
      title: 'Risk Manager',
      company: 'HSBC Risk Management',
      location: 'London',
      salary: '£60,000 - £90,000',
      description: 'Identify and mitigate financial risks. Develop risk management frameworks and policies.',
      requirements: ['Risk management expertise', 'Financial knowledge', 'Compliance awareness', 'Analytical skills', 'Communication'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Finance',
      applyUrl: 'https://careers.hsbc.com/job-19',
    },
    {
      id: `job-${jobId++}`,
      title: 'Actuary',
      company: 'Aviva Insurance',
      location: 'Norwich',
      salary: '£55,000 - £85,000',
      description: 'Assess insurance risks and develop pricing models. Ensure financial stability of insurance products.',
      requirements: ['Actuarial science degree', 'Actuarial exams', 'Statistical knowledge', 'Risk assessment', 'Financial modeling'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Finance',
      applyUrl: 'https://careers.aviva.com/job-20',
    }
  );

  // Legal category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Solicitor',
      company: 'Clifford Chance Law Firm',
      location: 'London',
      salary: '£45,000 - £80,000',
      description: 'Provide legal advice and representation to clients. Handle contracts, litigation, and corporate matters.',
      requirements: ['Law degree (LLB)', 'Solicitor qualification (SQE)', 'Legal experience', 'Client management', 'Legal research'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Legal',
      applyUrl: 'https://careers.cliffordchance.com/job-21',
    },
    {
      id: `job-${jobId++}`,
      title: 'Barrister',
      company: 'Lincoln\'s Inn Chambers',
      location: 'London',
      salary: '£60,000 - £120,000',
      description: 'Provide specialist legal advice and appear in court. Handle complex litigation cases.',
      requirements: ['Law degree', 'Bar practice course', 'Legal expertise', 'Advocacy skills', 'Case preparation'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Legal',
      applyUrl: 'https://careers.lincolnsinn.com/job-22',
    },
    {
      id: `job-${jobId++}`,
      title: 'Paralegal',
      company: 'Legal Services Ltd',
      location: 'London',
      salary: '£25,000 - £40,000',
      description: 'Support solicitors with document preparation, research, and client administration.',
      requirements: ['Paralegal diploma', 'Legal knowledge', 'Administrative skills', 'Attention to detail', 'Client support'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Legal',
      applyUrl: 'https://careers.legalservices.com/job-23',
    },
    {
      id: `job-${jobId++}`,
      title: 'In-House Legal Counsel',
      company: 'FTSE 100 Corporation',
      location: 'London',
      salary: '£70,000 - £110,000',
      description: 'Manage legal matters for a large corporation. Oversee contracts, compliance, and litigation.',
      requirements: ['Solicitor qualification', 'In-house experience', 'Corporate law', 'Contract management', 'Compliance knowledge'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Legal',
      applyUrl: 'https://careers.ftse100corp.com/job-24',
    }
  );

  // Education category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Secondary School Teacher',
      company: 'London Secondary School',
      location: 'London',
      salary: '£28,000 - £45,000',
      description: 'Teach secondary students in your subject specialism. Create engaging lesson plans and assess student progress.',
      requirements: ['University degree', 'PGCE or teacher training', 'Subject expertise', 'Teaching skills', 'Curriculum knowledge'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Education',
      applyUrl: 'https://careers.londonsecondary.com/job-25',
    },
    {
      id: `job-${jobId++}`,
      title: 'University Lecturer',
      company: 'Oxford University',
      location: 'Oxford',
      salary: '£40,000 - £60,000',
      description: 'Teach and conduct research at university level. Supervise student research projects and publish academic papers.',
      requirements: ['PhD in subject', 'Research experience', 'Teaching experience', 'Publication record', 'Academic knowledge'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Education',
      applyUrl: 'https://careers.oxford.ac.uk/job-26',
    },
    {
      id: `job-${jobId++}`,
      title: 'School Principal',
      company: 'Premier Independent School',
      location: 'London',
      salary: '£55,000 - £80,000',
      description: 'Lead and manage a school community. Ensure educational standards and staff development.',
      requirements: ['Teaching experience', 'Leadership qualification', 'School management', 'Strategic planning', 'Education policy'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Education',
      applyUrl: 'https://careers.premierindependent.com/job-27',
    },
    {
      id: `job-${jobId++}`,
      title: 'Educational Psychologist',
      company: 'Child Development Centre',
      location: 'Manchester',
      salary: '£45,000 - £65,000',
      description: 'Assess and support students with learning difficulties. Develop intervention strategies.',
      requirements: ['Psychology degree', 'Educational psychology qualification', 'Assessment skills', 'Counseling skills', 'Research knowledge'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Education',
      applyUrl: 'https://careers.childdevelopment.com/job-28',
    }
  );

  // Engineering category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Civil Engineer',
      company: 'Infrastructure Solutions',
      location: 'London',
      salary: '£40,000 - £65,000',
      description: 'Design and manage civil engineering projects including roads, bridges, and buildings.',
      requirements: ['Engineering degree', 'Professional registration (CEng)', 'CAD software', 'Project management', 'Site management'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Engineering',
      applyUrl: 'https://careers.infrastructuresolutions.com/job-29',
    },
    {
      id: `job-${jobId++}`,
      title: 'Mechanical Engineer',
      company: 'Advanced Manufacturing Ltd',
      location: 'Birmingham',
      salary: '£42,000 - £68,000',
      description: 'Design and develop mechanical systems and components. Oversee manufacturing processes.',
      requirements: ['Engineering degree', 'CAD expertise', 'Manufacturing knowledge', 'Problem-solving', 'Technical drawing'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Engineering',
      applyUrl: 'https://careers.advancedmanufacturing.com/job-30',
    },
    {
      id: `job-${jobId++}`,
      title: 'Electrical Engineer',
      company: 'Power Systems Inc',
      location: 'Scotland',
      salary: '£45,000 - £70,000',
      description: 'Design electrical systems and power distribution networks. Ensure compliance with safety standards.',
      requirements: ['Electrical engineering degree', 'Professional registration', 'MATLAB/Simulink', 'Power systems knowledge', 'Circuit design'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Engineering',
      applyUrl: 'https://careers.powersystems.com/job-31',
    },
    {
      id: `job-${jobId++}`,
      title: 'Chemical Engineer',
      company: 'Chemical Processing',
      location: 'Teesside',
      salary: '£48,000 - £75,000',
      description: 'Design chemical production processes and facilities. Ensure safety and efficiency.',
      requirements: ['Chemical engineering degree', 'Process design', 'Safety management', 'Project management', 'Regulatory compliance'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Engineering',
      applyUrl: 'https://careers.chemicalprocessing.com/job-32',
    },
    {
      id: `job-${jobId++}`,
      title: 'Aerospace Engineer',
      company: 'BAE Systems Aerospace',
      location: 'Bristol',
      salary: '£50,000 - £80,000',
      description: 'Design and develop aircraft components and systems. Work on cutting-edge aerospace technology.',
      requirements: ['Aerospace engineering degree', 'CAD software', 'Aerodynamics knowledge', 'Systems engineering', 'Project experience'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Engineering',
      applyUrl: 'https://careers.baesystems.com/job-33',
    }
  );

  // Marketing category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Digital Marketing Manager',
      company: 'Digital Growth Agency',
      location: 'London',
      salary: '£40,000 - £60,000',
      description: 'Manage digital marketing campaigns across multiple channels. Lead marketing team and track ROI.',
      requirements: ['Marketing degree or experience', 'Digital analytics', 'Campaign management', 'Team leadership', 'Content marketing'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Marketing',
      applyUrl: 'https://careers.digitalgrowth.com/job-34',
    },
    {
      id: `job-${jobId++}`,
      title: 'SEO Specialist',
      company: 'Search Engine Masters',
      location: 'Remote',
      salary: '£30,000 - £50,000',
      description: 'Optimize websites for search engines. Manage SEO strategy and keyword research.',
      requirements: ['SEO expertise', 'Keyword research', 'Technical SEO', 'Analytics', 'Backlink strategy'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Marketing',
      applyUrl: 'https://careers.searchmasters.com/job-35',
    },
    {
      id: `job-${jobId++}`,
      title: 'Brand Manager',
      company: 'Luxury Brand Co',
      location: 'London',
      salary: '£45,000 - £65,000',
      description: 'Develop and manage brand strategy. Oversee brand positioning and communications.',
      requirements: ['Brand management experience', 'Strategic thinking', 'Market analysis', 'Creative direction', 'Communication skills'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Marketing',
      applyUrl: 'https://careers.luxurybrand.com/job-36',
    },
    {
      id: `job-${jobId++}`,
      title: 'Content Strategist',
      company: 'Content Hub',
      location: 'Manchester',
      salary: '£35,000 - £55,000',
      description: 'Develop content strategy and create engaging content. Manage editorial calendar and publishing.',
      requirements: ['Content creation', 'Strategic planning', 'Writing skills', 'SEO knowledge', 'Analytics'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Marketing',
      applyUrl: 'https://careers.contenthub.com/job-37',
    },
    {
      id: `job-${jobId++}`,
      title: 'Marketing Director',
      company: 'Fortune 500 Company',
      location: 'London',
      salary: '£70,000 - £100,000',
      description: 'Lead marketing department and set company marketing strategy. Manage large marketing budgets.',
      requirements: ['Senior marketing experience', 'Leadership skills', 'Strategic planning', 'Budget management', 'Industry knowledge'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Marketing',
      applyUrl: 'https://careers.fortune500.com/job-38',
    }
  );

  // Sales category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Account Executive',
      company: 'Enterprise Sales Corp',
      location: 'London',
      salary: '£30,000 - £50,000 + OTE',
      description: 'Manage key client accounts and drive revenue growth. Develop new business relationships.',
      requirements: ['Sales experience', 'Client management', 'Negotiation skills', 'Product knowledge', 'CRM expertise'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Sales',
      applyUrl: 'https://careers.enterprisesales.com/job-39',
    },
    {
      id: `job-${jobId++}`,
      title: 'Business Development Manager',
      company: 'Growth Partners Ltd',
      location: 'London',
      salary: '£45,000 - £70,000 + OTE',
      description: 'Identify and develop new business opportunities. Build strategic partnerships.',
      requirements: ['Business development experience', 'Relationship building', 'Market analysis', 'Strategic thinking', 'Negotiation'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Sales',
      applyUrl: 'https://careers.growthpartners.com/job-40',
    },
    {
      id: `job-${jobId++}`,
      title: 'Sales Director',
      company: 'Premier Sales Group',
      location: 'London',
      salary: '£80,000 - £120,000 + OTE',
      description: 'Lead sales team and set sales strategy. Achieve revenue targets and manage sales operations.',
      requirements: ['Senior sales experience', 'Team leadership', 'Sales strategy', 'Target management', 'Industry expertise'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Sales',
      applyUrl: 'https://careers.premiersalesgroup.com/job-41',
    },
    {
      id: `job-${jobId++}`,
      title: 'Inside Sales Representative',
      company: 'Telecom Solutions',
      location: 'Remote',
      salary: '£25,000 - £40,000 + OTE',
      description: 'Handle inbound sales inquiries and conduct phone-based sales. Achieve sales targets.',
      requirements: ['Sales experience', 'Phone sales skills', 'Customer service', 'Product knowledge', 'Closing ability'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Sales',
      applyUrl: 'https://careers.telecomsolutions.com/job-42',
    }
  );

  // HR category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'HR Manager',
      company: 'Human Resources Plus',
      location: 'London',
      salary: '£40,000 - £60,000',
      description: 'Manage HR functions including recruitment, employee relations, and payroll.',
      requirements: ['HR experience', 'Employment law', 'Recruitment', 'Employee relations', 'CIPD qualification'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'HR',
      applyUrl: 'https://careers.hrplus.com/job-43',
    },
    {
      id: `job-${jobId++}`,
      title: 'Talent Acquisition Specialist',
      company: 'Recruitment First',
      location: 'Manchester',
      salary: '£35,000 - £55,000',
      description: 'Source and recruit talent for the organization. Manage recruitment process.',
      requirements: ['Recruitment experience', 'Sourcing skills', 'Candidate assessment', 'ATS knowledge', 'Interview skills'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'HR',
      applyUrl: 'https://careers.recruitmentfirst.com/job-44',
    },
    {
      id: `job-${jobId++}`,
      title: 'Learning & Development Specialist',
      company: 'Talent Development Co',
      location: 'Birmingham',
      salary: '£35,000 - £55,000',
      description: 'Design and deliver training programs. Support employee development and learning.',
      requirements: ['L&D experience', 'Instructional design', 'Training delivery', 'LMS knowledge', 'Adult learning'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'HR',
      applyUrl: 'https://careers.talentdevelopment.com/job-45',
    },
    {
      id: `job-${jobId++}`,
      title: 'HR Business Partner',
      company: 'Strategic HR Solutions',
      location: 'London',
      salary: '£50,000 - £70,000',
      description: 'Partner with business units to support HR strategy. Manage employee relations and organizational development.',
      requirements: ['HRBP experience', 'Strategic thinking', 'Change management', 'Employee relations', 'Business acumen'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'HR',
      applyUrl: 'https://careers.strategichrsolutions.com/job-46',
    }
  );

  // Creative category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Graphic Designer',
      company: 'Creative Studio',
      location: 'London',
      salary: '£28,000 - £45,000',
      description: 'Create visual content for digital and print media. Design logos, branding, and marketing materials.',
      requirements: ['Design software (Adobe CC)', 'Visual design', 'Branding knowledge', 'Typography', 'Creative thinking'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Creative',
      applyUrl: 'https://careers.creativestudio.com/job-47',
    },
    {
      id: `job-${jobId++}`,
      title: 'Copywriter',
      company: 'Copy & Co',
      location: 'Remote',
      salary: '£30,000 - £50,000',
      description: 'Write compelling copy for marketing materials. Create content for web, email, and social media.',
      requirements: ['Writing skills', 'Marketing knowledge', 'SEO awareness', 'Editing skills', 'Brand voice'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Creative',
      applyUrl: 'https://careers.copyandco.com/job-48',
    },
    {
      id: `job-${jobId++}`,
      title: 'Video Producer',
      company: 'Multimedia Productions',
      location: 'London',
      salary: '£35,000 - £55,000',
      description: 'Produce and edit video content for marketing and social media. Manage video projects from concept to delivery.',
      requirements: ['Video editing software', 'Production knowledge', 'Creative vision', 'Project management', 'Post-production'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Creative',
      applyUrl: 'https://careers.multimediaproductions.com/job-49',
    },
    {
      id: `job-${jobId++}`,
      title: 'Art Director',
      company: 'Premium Advertising',
      location: 'London',
      salary: '£45,000 - £70,000',
      description: 'Lead creative direction for advertising campaigns. Manage design team and establish visual standards.',
      requirements: ['Art direction experience', 'Design expertise', 'Leadership', 'Campaign management', 'Creative vision'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Creative',
      applyUrl: 'https://careers.premiumadvertising.com/job-50',
    }
  );

  // Construction category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Project Manager',
      company: 'Construction Excellence',
      location: 'London',
      salary: '£50,000 - £75,000',
      description: 'Manage construction projects from planning to completion. Control budgets and schedules.',
      requirements: ['Construction PM experience', 'Budget management', 'Risk management', 'Team leadership', 'Technical knowledge'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Construction',
      applyUrl: 'https://careers.constructionexcellence.com/job-51',
    },
    {
      id: `job-${jobId++}`,
      title: 'Site Manager',
      company: 'Build & Construct',
      location: 'Various',
      salary: '£45,000 - £65,000',
      description: 'Oversee construction site operations. Ensure health and safety compliance.',
      requirements: ['Site management experience', 'Health & safety', 'Construction knowledge', 'Team management', 'Quality control'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Construction',
      applyUrl: 'https://careers.buildandconstruct.com/job-52',
    }
  );

  // Hospitality category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Hotel General Manager',
      company: 'Luxury Hotels International',
      location: 'London',
      salary: '£45,000 - £70,000',
      description: 'Manage hotel operations and guest experience. Lead hotel team and achieve revenue targets.',
      requirements: ['Hotel management experience', 'Leadership', 'Revenue management', 'Guest service', 'Operations'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Hospitality',
      applyUrl: 'https://careers.luxuryhotels.com/job-53',
    },
    {
      id: `job-${jobId++}`,
      title: 'Head Chef',
      company: 'Fine Dining Restaurant',
      location: 'London',
      salary: '£35,000 - £55,000',
      description: 'Create and oversee menu development. Lead kitchen team and maintain food standards.',
      requirements: ['Culinary training', 'Kitchen management', 'Menu development', 'Food safety', 'Team leadership'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Hospitality',
      applyUrl: 'https://careers.finediningrestaurant.com/job-54',
    }
  );

  // Logistics category
  jobs.push(
    {
      id: `job-${jobId++}`,
      title: 'Supply Chain Manager',
      company: 'Global Logistics',
      location: 'Manchester',
      salary: '£45,000 - £70,000',
      description: 'Manage supply chain operations and logistics. Optimize cost and delivery performance.',
      requirements: ['Supply chain experience', 'Logistics knowledge', 'Vendor management', 'Systems expertise', 'Problem-solving'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Logistics',
      applyUrl: 'https://careers.globallogistics.com/job-55',
    },
    {
      id: `job-${jobId++}`,
      title: 'Warehouse Manager',
      company: 'Distribution Hub Ltd',
      location: 'Midlands',
      salary: '£30,000 - £45,000',
      description: 'Manage warehouse operations and staff. Ensure accurate inventory and on-time shipments.',
      requirements: ['Warehouse management', 'Health & safety', 'Inventory control', 'Team leadership', 'System usage'],
      postedDate: getRandomDate(),
      type: 'full-time',
      category: 'Logistics',
      applyUrl: 'https://careers.distributionhub.com/job-56',
    }
  );

  return jobs;
};

const mockJobs = generateMockJobs();

export function registerJobRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = createBearerAuth(app);

  // POST /api/jobs/search
  fastify.post('/api/jobs/search', {
    schema: {
      description: 'Search for jobs with filtering and pagination',
      tags: ['jobs'],
      body: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          location: { type: 'string', description: 'Filter by location' },
          category: { type: 'string', description: 'Filter by job category' },
          page: { type: 'integer', default: 1, description: 'Page number' },
          resultsPerPage: { type: 'integer', default: 10, description: 'Results per page' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobs: { type: 'array' },
            total: { type: 'number' },
            page: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { query?: string; location?: string; category?: string; page?: number; resultsPerPage?: number } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { query, location, category, page = 1, resultsPerPage = 10 } = request.body;

    app.logger.info({ userId: session.user.id, query, location, category, page }, 'Searching jobs');

    try {
      // Try Adzuna first if configured
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;

      if (appId && appKey && query) {
        try {
          const url = new URL(`https://api.adzuna.com/v1/api/jobs/gb/search/${page}`);
          url.searchParams.append('app_id', appId);
          url.searchParams.append('app_key', appKey);
          url.searchParams.append('results_per_page', resultsPerPage.toString());
          url.searchParams.append('what', query);
          if (location) url.searchParams.append('where', location);
          url.searchParams.append('content-type', 'application/json');

          const response = await fetch(url.toString());
          if (response.ok) {
            const data = await response.json() as any;
            const jobs = (data.results || []).map((job: AdzunaJob) => ({
              id: job.id,
              title: job.title,
              company: job.company.display_name,
              location: job.location.display_name,
              salary: job.salary_min && job.salary_max ? `£${job.salary_min} - £${job.salary_max}` : 'Competitive',
              description: job.description,
              requirements: [],
              postedDate: job.created,
              type: 'full-time' as const,
              category: job.category.label,
              applyUrl: job.redirect_url,
            }));

            app.logger.info({ jobCount: jobs.length, total: data.count }, 'Jobs found via Adzuna');
            return {
              jobs,
              total: data.count,
              page,
              totalPages: Math.ceil(data.count / resultsPerPage),
            };
          }
        } catch (adzunaErr) {
          app.logger.warn({ err: adzunaErr }, 'Adzuna API failed, using mock data');
        }
      }

      // Fallback to mock data
      let filtered = [...mockJobs];

      // Filter by query (title, company, description, category)
      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter((job) =>
          job.title.toLowerCase().includes(lowerQuery) ||
          job.company.toLowerCase().includes(lowerQuery) ||
          job.description.toLowerCase().includes(lowerQuery) ||
          job.category.toLowerCase().includes(lowerQuery)
        );
      }

      // Filter by location
      if (location) {
        const lowerLocation = location.toLowerCase();
        filtered = filtered.filter((job) =>
          job.location.toLowerCase().includes(lowerLocation)
        );
      }

      // Filter by category
      if (category) {
        filtered = filtered.filter((job) =>
          job.category.toLowerCase() === category.toLowerCase()
        );
      }

      // Pagination
      const start = (page - 1) * resultsPerPage;
      const end = start + resultsPerPage;
      const paginatedJobs = filtered.slice(start, end);

      app.logger.info({ jobCount: paginatedJobs.length, total: filtered.length, page }, 'Mock jobs returned');
      return {
        jobs: paginatedJobs,
        total: filtered.length,
        page,
        totalPages: Math.ceil(filtered.length / resultsPerPage),
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to search jobs');
      return reply.status(500).send({ error: 'Failed to search jobs' });
    }
  });
}
