# SendBox

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite&logoColor=white)
![Redux](https://img.shields.io/badge/Redux_Toolkit-764ABC?style=flat&logo=redux&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=flat&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?style=flat&logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

브라우저 기반의 종단 간 암호화(E2E) 파일 및 텍스트 공유 서비스입니다.

파일은 서버로 전송되기 전에 클라이언트에서 완전히 암호화되며, 서버는 평문 데이터를 일절 처리하지 않습니다.

다운로더는 6자리 숫자 키를 입력해 공유된 콘텐츠를 받을 수 있습니다.

[사이트 바로가기](https://junyoung1201.github.io/sendbox)

---

## 주요 기능

- **세 가지 콘텐츠 유형:** 파일, 텍스트, URL 공유 지원
- **클라이언트 사이드 암호화:**
  - Web Crypto API 기반 AES-256-GCM 암호화
  - 키는 절대 브라우저 밖으로 전송되지 않음
- **선택적 비밀번호 보호:** PBKDF2로 암호화 키를 파생시키며, 서버에는 비밀번호의 bcrypt 해시만 저장
- **청크 업로드 및 스트리밍 다운로드:** 
  - 90 MB 단위로 분할 업로드
  - StreamSaver.js를 사용해 파일 전체를 메모리에 올리지 않고 디스크에 직접 기록
- **실시간 진행 상황:** Socket.IO를 통해 업로더가 수신자의 다운로드 진행률, 완료, 중단 이벤트를 실시간으로 확인
- **업로드 & 공유 취소:** 업로드 중 취소 또는 다운로드 전 공유 철회 가능
- **자동 만료 및 1회 다운로드:**
  - 업로드 후 12시간 경과 시 자동 만료
  - 첫 번째 다운로드 완료 즉시 삭제
- **IP별 저장 용량 제한:** IP당 전체 활성 업로드 합계 최대 100 GB
- **파일 크기 제한:** 비로그인 사용자 2 GB, 로그인 사용자 100 GB
- **반응형 웹 디자인:**  모바일 전용 레이아웃 제공

---

## 기술 스택

### 프론트엔드

| 구분 | 기술 |
|---|---|
| 프레임워크 | React 19 + TypeScript |
| 빌드 도구 | Vite |
| 상태 관리 | Redux Toolkit |
| 라우팅 | React Router |
| HTTP | Axios |
| 실시간 통신 | Socket.IO Client |
| 스트리밍 | StreamSaver.js |

### 백엔드

| 구분 | 기술 |
|---|---|
| 런타임 | Node.js + TypeScript |
| 프레임워크 | Express |
| 데이터베이스 | PostgreSQL |
| 인증 | jwt + bcrypt |
| 실시간 통신 | Socket.IO |
| 파일 업로드 | Multer |

---

## 동작 방식

### 업로드

1. 사용자가 파일, 텍스트, URL을 선택하고 선택적으로 비밀번호를 설정합니다.
2. 비밀번호가 설정된 경우, 브라우저가 PBKDF2(반복 횟수 100,000회, SHA-256, 무작위 16바이트 솔트)를 사용해 AES-256-GCM 키를 파생합니다.
3. 콘텐츠를 90 MB 단위 청크로 분할하고 각 청크를 클라이언트에서 암호화한 뒤 서버로 전송합니다.
4. 모든 청크 업로드가 완료되면 서버가 청크 수를 검증하고 6자리 파일 키를 발급합니다.
5. 업로더가 키(및 비밀번호)를 수신자에게 별도 채널로 전달합니다.

### 다운로드

1. 수신자가 6자리 키를 입력합니다.
2. 서버가 암호화된 청크를 순서대로 브라우저에 스트리밍합니다.
3. 브라우저가 각 청크를 복호화하고 StreamSaver.js를 통해 디스크에 직접 씁니다.
4. 다운로드 완료 시 서버가 관련 청크와 메타데이터를 모두 삭제합니다.

---

## 백엔드 API

### 인증 관련

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 및 세션 쿠키 발급 |
| POST | `/api/auth/logout` | 로그아웃 및 쿠키 삭제 |
| GET | `/api/auth/me` | 현재 로그인 사용자 조회 |

### 파일 관련

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/files/init-upload` | 업로드 초기화, 파일 키 발급 |
| POST | `/api/files/upload-chunk` | 암호화된 청크 업로드 |
| POST | `/api/files/complete-upload` | 업로드 완료 처리 |
| POST | `/api/files/cancel-upload` | 업로드 중단 및 취소 |
| DELETE | `/api/files/cancel-share/:key` | 완료된 업로드 공유 철회 |
| GET | `/api/files/download/:key` | 파일 메타데이터 조회 |
| GET | `/api/files/download/:key/chunk/:index` | 단일 청크 다운로드 |
| POST | `/api/files/complete-download/:key` | 다운로드 완료 처리 및 파일 삭제 |

---

## 라이선스

MIT
