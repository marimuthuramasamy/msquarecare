"""Populate the CRM with realistic demo data (leads, customers, policies, claims, tasks).

    cd backend && python seed_demo.py          # uses MONGO_URL / DB_NAME from .env
    cd backend && python seed_demo.py --wipe   # clears CRM collections first

Safe to run on an empty database only; refuses if customers already exist (unless --wipe).
"""
import asyncio
import random
import sys
from datetime import timedelta

import crm

FIRST = ["Arun", "Priya", "Karthik", "Meena", "Suresh", "Lakshmi", "Vignesh", "Divya", "Ramesh", "Kavitha",
         "Senthil", "Anitha", "Prakash", "Revathi", "Balaji", "Sangeetha", "Murugan", "Deepa", "Ganesh", "Saranya"]
LAST = ["Kumar", "Raj", "Subramanian", "Natarajan", "Pandian", "Krishnan", "Selvam", "Rajendran"]
CITIES = ["Trichy", "Thanjavur", "Karur", "Pudukkottai", "Ariyalur", "Perambalur", "Madurai", "Srirangam"]
PLANS = {
    "Health": [("Star Health", "Family Health Optima", 500000, 18500, 15), ("Niva Bupa", "ReAssure 2.0", 1000000, 24000, 15),
               ("Care Health", "Care Supreme", 700000, 16200, 15)],
    "Motor": [("ICICI Lombard", "Private Car Package", None, 11800, 12), ("Bajaj Allianz", "Two Wheeler Comprehensive", None, 2100, 15),
              ("Tata AIG", "Auto Secure", None, 14500, 12)],
    "Term / Life": [("HDFC Life", "Click 2 Protect Super", 10000000, 13900, 30), ("LIC", "Jeevan Amar", 5000000, 9800, 25)],
    "General": [("New India Assurance", "Shopkeeper Policy", 2000000, 6500, 12)],
}


async def seed(db, wipe=False):
    await crm.bootstrap(db)
    if wipe:
        for c in ("leads", "customers", "policies", "claims", "tasks", "activities"):
            await db[c].delete_many({})
    elif await db.customers.count_documents({}):
        print("Customers already exist — not seeding (use --wipe to reset demo data).")
        return
    rnd = random.Random(42)
    admin = await db.users.find_one({"role": "admin"})
    agent = await db.users.find_one({"email": "agent@msquarecare.com"})
    if not agent:
        agent = {"id": crm.new_id(), "name": "Ravi (Agent)", "email": "agent@msquarecare.com", "phone": "",
                 "role": "agent", "active": True, "password_hash": crm.hash_password("agent123"), "created_at": crm.now_iso()}
        await db.users.insert_one(agent)
    owners = [admin["id"], agent["id"]]
    today = crm.today()

    def person(i):
        return f"{FIRST[i % len(FIRST)]} {LAST[(i * 3) % len(LAST)]}", f"9{rnd.randint(100000000, 999999999)}"

    # customers + policies (renewal dates spread from -20 to +330 days)
    pcount = 0
    for i in range(14):
        name, phone = person(i)
        cid = crm.new_id()
        created = today - timedelta(days=rnd.randint(30, 600))
        await db.customers.insert_one({
            "id": cid, "name": name, "phone": phone, "phone_digits": phone, "email": f"{name.split()[0].lower()}@example.com",
            "city": rnd.choice(CITIES), "address": None, "dob": f"19{rnd.randint(60, 99)}-0{rnd.randint(1, 9)}-1{rnd.randint(0, 9)}",
            "pan": None, "notes": None, "source": rnd.choice(["website", "referral", "walk-in"]),
            "assigned_to": owners[i % 2], "created_at": created.isoformat() + "T10:00:00+00:00",
        })
        await crm.log_activity("customer", cid, "system", "Customer created (demo data)")
        for _ in range(rnd.choice([1, 1, 2])):
            ptype = rnd.choice(list(PLANS))
            insurer, plan, si, prem, comm = rnd.choice(PLANS[ptype])
            end = today + timedelta(days=rnd.randint(-20, 330))
            start = end - timedelta(days=364)
            pcount += 1
            pid = crm.new_id()
            await db.policies.insert_one({
                "id": pid, "customer_id": cid, "policy_number": f"{ptype[:2].upper()}{rnd.randint(1000000, 9999999)}",
                "insurer": insurer, "policy_type": ptype, "plan_name": plan, "sum_insured": si,
                "premium": round(prem * rnd.uniform(0.85, 1.25)), "payment_mode": "annual",
                "start_date": start.isoformat(), "end_date": end.isoformat(),
                "status": "active" if end >= today else "expired", "commission_pct": comm,
                "vehicle_number": f"TN 45 {chr(65 + rnd.randint(0, 25))}{chr(65 + rnd.randint(0, 25))} {rnd.randint(1000, 9999)}" if ptype == "Motor" else None,
                "members": "Self, spouse, 2 children" if ptype == "Health" else None, "nominee": None, "notes": None,
                "created_at": crm.now_iso(), "created_by": admin["id"],
            })
            if ptype in ("Health", "Motor") and rnd.random() < 0.3:
                await crm._create_claim(crm.ClaimIn(
                    policy_id=pid, claim_type="cashless" if ptype == "Health" else "own_damage",
                    incident_date=(today - timedelta(days=rnd.randint(3, 40))).isoformat(),
                    claimed_amount=rnd.choice([45000, 82000, 23000, 150000]),
                    hospital_or_garage=rnd.choice(["Kauvery Hospital", "Apollo Trichy", "Maruti Service, Trichy"]),
                    status=rnd.choice(["intimated", "documents_pending", "under_review", "approved"])), admin)

    # leads across the pipeline
    services = ["Health Insurance", "Motor Insurance", "Term / Life Insurance", "General Insurance", "Loans & Finance"]
    for i in range(16):
        name, phone = person(i + 20)
        status = ["new", "new", "new", "contacted", "contacted", "quoted", "quoted", "negotiation", "lost", "won"][i % 10]
        lid = crm.new_id()
        await db.leads.insert_one({
            "lead_id": lid, "name": name, "phone": phone, "email": None, "service": rnd.choice(services),
            "city": rnd.choice(CITIES), "message": rnd.choice(["Family floater for 4", "Car insurance renewal next month",
                                                              "1 Cr term cover", "Shop insurance", None]),
            "source": rnd.choice(["website", "whatsapp", "referral", "chatbot", "walk-in"]), "status": status,
            "assigned_to": owners[i % 2], "expected_premium": rnd.choice([None, 12000, 18000, 25000, 9000]),
            "follow_up_date": (today + timedelta(days=rnd.randint(-3, 10))).isoformat() if status not in ("won", "lost") else None,
            "created_at": (today - timedelta(days=rnd.randint(0, 50))).isoformat() + "T09:30:00+00:00", "updated_at": crm.now_iso(),
        })
        await crm.log_activity("lead", lid, "system", "Enquiry received (demo data)")

    await crm.generate_renewal_tasks(days=30, user=admin)
    print(f"Seeded 14 customers, {pcount} policies, 16 leads. Agent login: agent@msquarecare.com / agent123")


if __name__ == "__main__":
    import os
    from pathlib import Path
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient

    load_dotenv(Path(__file__).parent / ".env")
    database = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    asyncio.run(seed(database, wipe="--wipe" in sys.argv))
