const express = require("express");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");
const app = express();
app.use(express.json()); // Parse incoming JSON requests
app.use(cors()); // Allow cross-origin requests

// SQL Server connection configuration
const dbConfig = {
    server: "ANA\\SQLEXPRESS", 
    database: "TestareMedicamente",  
    driver: "msnodesqlv8",  // Using msnodesqlv8 for Windows authentication
    options: {
        trustedConnection: true,  // n for Windows Authentication
      //  encrypt: false,  
        trustServerCertificate: true,  
    },
};

// Creare pool de conexiuni
const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect();


pool.connect()
    .then(() => console.log("Database connected successfully"))
    .catch(err => console.error("Database connection failed:", err));

pool.on("error", (err) => {
    console.error("Eroare în pool-ul de conexiuni:", err);
});


app.get('/dashboard/stats', async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM Pacienti) AS TotalPacienti,
                (SELECT COUNT(*) FROM Medic) AS TotalMedici,
                (SELECT COUNT(*) FROM CabinetTestare) AS TotalCabinete,
                (SELECT COUNT(*) FROM Medicamente) AS TotalMedicamente,
                (SELECT COUNT(*) FROM Producator) AS TotalProducatori;
        `;
        const result = await pool.request().query(statsQuery);
        res.status(200).json(result.recordset[0]);
    } catch (error) {
        console.error("Eroare la preluarea statisticilor:", error.message);
        res.status(500).json({ message: "Eroare la server", error: error.message });
    }
});

app.get('/testari-clinice-in-progres', async (req, res) => {
    try {
        const query = `
            SELECT 
                tc.IDTestare,
                tc.Nume AS NumeTestare,
                tc.Data_Inceput,
                tc.Data_Sfarsit,
                m.Denumire AS Medicament,
                CONCAT(md.Nume, ' ', md.Prenume) AS MedicResponsabil
            FROM 
                TestareClinica tc
            LEFT JOIN 
                Medicamente m ON tc.IDMedicament = m.IDMedicament
            LEFT JOIN 
                Medic md ON tc.IDMedic = md.IDMedic
            WHERE 
                tc.Data_Sfarsit IS NULL
            ORDER BY 
                tc.Data_Inceput DESC;
        `;
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea testărilor clinice în progres:", error.message);
        res.status(500).json({ message: "Eroare la server", error: error.message });
    }
});


app.get('/dashboard/top-doctors', async (req, res) => {
    try {
        const query = `
            SELECT TOP 5 
                m.Nume, 
                m.Prenume, 
                COUNT(DISTINCT mc.Rol_medic) AS NumarRoluri
            FROM Medic m
            INNER JOIN MedicCabinete mc ON m.IDMedic = mc.IDMedic
            GROUP BY m.Nume, m.Prenume
            ORDER BY NumarRoluri DESC;
        `;
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea medicilor cu cele mai multe roluri:", error.message);
        res.status(500).json({ message: "Eroare la server", error: error.message });
    }
});



// Lista tuturor pacienților
app.get("/patients", async (req, res) => {
    const query = "SELECT * FROM Pacienti ORDER BY IDPacient";
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea pacienților:", error.message);
        res.status(500).json({ message: "Eroare la server." });
    }
});

// Adăugarea unui nou pacient
app.post("/patients", async (req, res) => {
    const { Nume, Prenume, Adresa, DataNasterii, Sex, NrTelefon, Mail, CNP } = req.body;

    // Validare câmpuri obligatorii
    if (!Nume || !Prenume || !Sex || !DataNasterii || !CNP || !NrTelefon) {
        return res.status(400).json({ message: "Toate câmpurile obligatorii trebuie completate." });
    }

    if (Sex !== "M" && Sex !== "F") {
        return res.status(400).json({ message: "Sexul trebuie să fie 'M' sau 'F'." });
    }

    if (CNP.length !== 13) {
        return res.status(400).json({ message: "CNP-ul trebuie să conțină exact 13 caractere." });
    }

    const query = `
        INSERT INTO Pacienti (Nume, Prenume, Adresa, DataNasterii, Sex, NrTelefon, Mail, CNP)
        OUTPUT INSERTED.*
        VALUES (@Nume, @Prenume, @Adresa, @DataNasterii, @Sex, @NrTelefon, @Mail, @CNP);
    `;
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("Nume", sql.NVarChar(50), Nume)
            .input("Prenume", sql.NVarChar(50), Prenume)
            .input("Adresa", sql.NVarChar(100), Adresa || null)
            .input("DataNasterii", sql.Date, DataNasterii)
            .input("Sex", sql.Char(1), Sex)
            .input("NrTelefon", sql.Char(20), NrTelefon)
            .input("Mail", sql.NVarChar(50), Mail || null)
            .input("CNP", sql.Char(13), CNP)
            .query(query);
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Eroare la adăugarea pacientului:", error.message);
        res.status(500).json({ message: "Eroare la server." });
    }
});

// Actualizarea unui pacient
app.put("/patients/:id", async (req, res) => {
    const { id } = req.params;
    const { Nume, Prenume, Adresa, DataNasterii, Sex, NrTelefon, Mail, CNP } = req.body;

    if (!Nume || !Prenume || !Sex || !DataNasterii || !CNP || !NrTelefon) {
        return res.status(400).json({ message: "Toate câmpurile obligatorii trebuie completate." });
    }

    if (Sex !== "M" && Sex !== "F") {
        return res.status(400).json({ message: "Sexul trebuie să fie 'M' sau 'F'." });
    }

    if (CNP.length !== 13) {
        return res.status(400).json({ message: "CNP-ul trebuie să conțină exact 13 caractere." });
    }

    const query = `
        UPDATE Pacienti
        SET Nume = @Nume, Prenume = @Prenume, Adresa = @Adresa, DataNasterii = @DataNasterii,
            Sex = @Sex, NrTelefon = @NrTelefon, Mail = @Mail, CNP = @CNP
        OUTPUT INSERTED.*
        WHERE IDPacient = @IDPacient;
    `;
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("IDPacient", sql.Int, id)
            .input("Nume", sql.NVarChar(50), Nume)
            .input("Prenume", sql.NVarChar(50), Prenume)
            .input("Adresa", sql.NVarChar(100), Adresa || null)
            .input("DataNasterii", sql.Date, DataNasterii)
            .input("Sex", sql.Char(1), Sex)
            .input("NrTelefon", sql.Char(20), NrTelefon)
            .input("Mail", sql.NVarChar(50), Mail || null)
            .input("CNP", sql.Char(13), CNP)
            .query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Pacientul nu a fost găsit." });
        }

        res.status(200).json(result.recordset[0]);
    } catch (error) {
        console.error("Eroare la actualizarea pacientului:", error.message);
        res.status(500).json({ message: "Eroare la server." });
    }
});

// Ștergerea unui pacient
app.delete("/patients/:id", async (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM Pacienti WHERE IDPacient = @IDPacient";

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input("IDPacient", sql.Int, id).query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Pacientul nu a fost găsit." });
        }

        res.status(200).json({ message: "Pacientul a fost șters cu succes." });
    } catch (error) {
        console.error("Eroare la ștergerea pacientului:", error.message);
        res.status(500).json({ message: "Eroare la server." });
    }
});

app.get("/patients/filter-by-address", async (req, res) => {
    const { address } = req.query;
  
    if (!address) {
      return res.status(400).json({ message: "Adresa este necesară pentru filtrare." });
    }
  
    const query = `
      SELECT *
      FROM Pacienti
      WHERE Adresa LIKE '%' + @address + '%'
    `;
  
    try {
      const result = await pool
        .request()
        .input("address", sql.NVarChar, address)
        .query(query);
  
      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "Nu s-au găsit pacienți pentru adresa specificată." });
      }
  
      res.status(200).json(result.recordset);
    } catch (error) {
      console.error("Eroare la filtrarea pacienților:", error.message);
      res.status(500).json({ message: "Eroare la server." });
    }
  });

  app.get("/patients/filter-by-sex", async (req, res) => {
    const query = `
        SELECT Sex, COUNT(*) AS NumarPacienti
        FROM Pacienti
        WHERE IDPacient IN (
            SELECT DISTINCT IDPacient
            FROM RezultatTestare
        )
        GROUP BY Sex
    `;

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(query);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la filtrarea pacienților după sex:", error.message);
        res.status(500).json({ message: "Eroare la server." });
    }
});



  

// Utilizator unic 
const adminUser = {
    email: "ana_fedeles10@yahoo.com",
    password: "Parola1234",
};

// Endpoint pentru login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (email === adminUser.email && password === adminUser.password) {
        return res.status(200).json({
            message: "Success",
            isAdmin: true,
        });
    } else {
        return res.status(401).json({ message: "Invalid email or password" });
    }
});


app.post('/logout', (req, res) => {
    res.status(200).json({ message: "User logged out successfully" });
});


// Endpoint pentru interogarea complexă medicamente
app.get('/medicamente/avansate', async (req, res) => {
    try {
        const query = `
            SELECT 
                M.IDMedicament,
                M.Denumire,
                M.Descriere,
                M.Pret,
                P.Nume AS NumeProducator
            FROM Medicamente M
            LEFT JOIN Producator P ON M.IDProducator = P.IDProducator
            WHERE M.Pret > (
                SELECT AVG(Pret) 
                FROM Medicamente
            )
        `;

        const result = await pool.request().query(query);
        console.log("Rezultate medicamente avansate:", result.recordset); // Debugging
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea medicamentelor avansate:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});


app.get('/medicamente', async (req, res) => {
    try {
        const query = `
            SELECT 
                M.IDMedicament,
                M.Denumire,
                M.Descriere,
                M.Pret,
                P.Nume AS NumeProducator
            FROM Medicamente M
            LEFT JOIN Producator P ON M.IDProducator = P.IDProducator;
        `;
        const result = await pool.request().query(query);
        console.log("Rezultate medicamente:", result.recordset); // Debugging
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea medicamentelor:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});



app.get('/producatori', async (req, res) => {
    try {
        const { nume, tara, sort } = req.query;

        let query = `
            SELECT *
            FROM Producator
            WHERE 1=1
        `;

        if (nume) {
            query += ` AND Nume LIKE '%' + @nume + '%'`;
        }

        if (tara) {
            query += ` AND Tara = @tara`;
        }

        if (sort) {
            query += ` ORDER BY Nume ${sort.toUpperCase()}`; // ASC sau DESC
        }

        const request = pool.request();
        if (nume) request.input('nume', sql.NVarChar, nume);
        if (tara) request.input('tara', sql.NVarChar, tara);

        const result = await request.query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea producătorilor:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

app.get('/producatori/tari', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT DISTINCT Tara 
            FROM Producator
        `);
        res.status(200).json(result.recordset.map((row) => row['Tara']));
    } catch (error) {
        console.error('Eroare la preluarea țărilor:', error);
        res.status(500).json({ message: 'Eroare la server' });
    }
});


//producători care au cel puțin un medicament asociat.
app.get('/producatori/medicamente', async (req, res) => {
    try {
        const query = `
            SELECT 
                P.IDProducator,
                P.Nume,
                P.Tara,
                P.Mail,
                P.Telefon,
                P.AdresaSediu,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 
                        FROM Medicamente M 
                        WHERE M.IDProducator = P.IDProducator
                    ) THEN 'Da'
                    ELSE 'Nu'
                END AS MedicamenteAsociate
            FROM Producator P;
        `;
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea producătorilor:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});



app.get('/medici', async (req, res) => {
    try {
        const query = `
            SELECT IDMedic, Nume, Prenume, Mail, Telefon, Experienta
            FROM Medic
        `;
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea medicilor:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

app.get('/medici/procent-experienta', async (req, res) => {
    try {
        const query = `
            SELECT 
                ROUND(CAST(COUNT(CASE WHEN Experienta > 10 THEN 1 END) AS FLOAT) / COUNT(*) * 100, 2) AS ProcentMediciPeste10Ani
            FROM 
                Medic;
        `;
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset[0]); // Trimite doar primul obiect (procentul)
    } catch (error) {
        console.error("Eroare la calcularea procentului:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

//cabinete
app.get('/cabinets', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM CabinetTestare ORDER BY IDCabinet DESC');
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea cabinetelor:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

app.post('/cabinets', async (req, res) => {
    try {
        const { NumeCabinet, Locatie, Capacitate } = req.body;

        if (!NumeCabinet || !Locatie || !Capacitate) {
            return res.status(400).json({ message: "Toate câmpurile sunt obligatorii" });
        }

        const query = `
            INSERT INTO CabinetTestare (NumeCabinet, Locatie, Capacitate)
            OUTPUT INSERTED.*
            VALUES (@NumeCabinet, @Locatie, @Capacitate)
        `;
        const request = pool.request();
        request.input('NumeCabinet', sql.NVarChar, NumeCabinet);
        request.input('Locatie', sql.NVarChar, Locatie);
        request.input('Capacitate', sql.NVarChar, Capacitate);

        const result = await request.query(query);
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Eroare la adăugarea cabinetului:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

app.put('/cabinets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { NumeCabinet, Locatie, Capacitate } = req.body;

        if (!NumeCabinet || !Locatie || !Capacitate) {
            return res.status(400).json({ message: "Toate câmpurile sunt obligatorii" });
        }

        const query = `
            UPDATE CabinetTestare
            SET NumeCabinet = @NumeCabinet, Locatie = @Locatie, Capacitate = @Capacitate
            OUTPUT INSERTED.*
            WHERE IDCabinet = @IDCabinet
        `;
        const request = pool.request();
        request.input('IDCabinet', sql.Int, id);
        request.input('NumeCabinet', sql.NVarChar, NumeCabinet);
        request.input('Locatie', sql.NVarChar, Locatie);
        request.input('Capacitate', sql.NVarChar, Capacitate);

        const result = await request.query(query);
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Cabinetul nu a fost găsit" });
        }
        res.status(200).json(result.recordset[0]);
    } catch (error) {
        console.error("Eroare la actualizarea cabinetului:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

app.delete('/cabinets/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = 'DELETE FROM CabinetTestare WHERE IDCabinet = @IDCabinet';
        const request = pool.request();
        request.input('IDCabinet', sql.Int, id);

        const result = await request.query(query);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Cabinetul nu a fost găsit" });
        }

        res.status(200).json({ message: "Cabinet șters cu succes" });
    } catch (error) {
        console.error("Eroare la ștergerea cabinetului:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});


//cabinete peste medie
app.get('/cabinets/above-average', async (req, res) => {
    try {
        const query = `
            SELECT *
            FROM CabinetTestare
            WHERE CAST(Capacitate AS INT) > (
                SELECT AVG(CAST(Capacitate AS INT))
                FROM CabinetTestare
            );
        `;
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la subcererea complexă:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

//afisare medici cabinete
app.get('/medic-cabinete', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM MedicCabinete');
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Eroare la preluarea datelor:', error);
        res.status(500).json({ message: 'Eroare la server' });
    }
});

//adauga o noua intrare
app.post('/medic-cabinete', async (req, res) => {
    const { IDMedic, IDCabinet, Rol_medic, Data_Incepere_activitate, Data_Finalizare_activitate } = req.body;
    const query = `
        INSERT INTO MedicCabinete (IDMedic, IDCabinet, Rol_medic, Data_Incepere_activitate, Data_Finalizare_activitate)
        OUTPUT INSERTED.*
        VALUES (@IDMedic, @IDCabinet, @Rol_medic, @Data_Incepere_activitate, @Data_Finalizare_activitate);
    `;
    try {
        const result = await pool.request()
            .input('IDMedic', sql.Int, IDMedic)
            .input('IDCabinet', sql.Int, IDCabinet)
            .input('Rol_medic', sql.NVarChar, Rol_medic)
            .input('Data_Incepere_activitate', sql.Date, Data_Incepere_activitate)
            .input('Data_Finalizare_activitate', sql.Date, Data_Finalizare_activitate)
            .query(query);
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Eroare la adăugare:', error);
        res.status(500).json({ message: 'Eroare la server' });
    }
});
//editare

app.put('/medic-cabinete/:id', async (req, res) => {
    const { IDMedic, IDCabinet, Rol_medic, Data_Incepere_activitate, Data_Finalizare_activitate } = req.body;
    const { id } = req.params;
    const query = `
        UPDATE MedicCabinete
        SET IDMedic = @IDMedic, IDCabinet = @IDCabinet, Rol_medic = @Rol_medic, 
            Data_Incepere_activitate = @Data_Incepere_activitate, Data_Finalizare_activitate = @Data_Finalizare_activitate
        OUTPUT INSERTED.*
        WHERE IDMedic_Cabinet = @IDMedic_Cabinet;
    `;
    try {
        const result = await pool.request()
            .input('IDMedic_Cabinet', sql.Int, id)
            .input('IDMedic', sql.Int, IDMedic)
            .input('IDCabinet', sql.Int, IDCabinet)
            .input('Rol_medic', sql.NVarChar, Rol_medic)
            .input('Data_Incepere_activitate', sql.Date, Data_Incepere_activitate)
            .input('Data_Finalizare_activitate', sql.Date, Data_Finalizare_activitate)
            .query(query);
        res.status(200).json(result.recordset[0]);
    } catch (error) {
        console.error('Eroare la actualizare:', error);
        res.status(500).json({ message: 'Eroare la server' });
    }
});

//stergere inregistrare
app.delete('/medic-cabinete/:id', async (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM MedicCabinete WHERE IDMedic_Cabinet = @IDMedic_Cabinet';
    try {
        const result = await pool.request()
            .input('IDMedic_Cabinet', sql.Int, id)
            .query(query);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Intrarea nu a fost găsită' });
        }
        res.status(200).json({ message: 'Șters cu succes' });
    } catch (error) {
        console.error('Eroare la ștergere:', error);
        res.status(500).json({ message: 'Eroare la server' });
    }
});

//obtinere nume medic, cabinet
app.get('/medic-cabinete-join', async (req, res) => {
    const query = `
        SELECT 
            mc.IDMedic_Cabinet,
            m.Nume AS NumeMedic,
            m.Prenume AS PrenumeMedic,
            ct.NumeCabinet,
            mc.Rol_medic,
            mc.Data_Incepere_activitate,
            mc.Data_Finalizare_activitate
        FROM 
            MedicCabinete mc
        INNER JOIN 
            Medic m ON mc.IDMedic = m.IDMedic
        INNER JOIN 
            CabinetTestare ct ON mc.IDCabinet = ct.IDCabinet
        ORDER BY 
            mc.IDMedic_Cabinet;
    `;
    try {
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea datelor:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

//medicii cu cele mai lungi perioade de activitate într-un cabinet:
app.get('/medici-cabinete-durata-max', async (req, res) => {
    try {
        const query = `
            SELECT 
                m.Nume AS NumeMedic,
                m.Prenume AS PrenumeMedic,
                ct.NumeCabinet,
                DATEDIFF(DAY, mc.Data_Incepere_activitate, mc.Data_Finalizare_activitate) AS ZileActivitate
            FROM 
                Medic m
            INNER JOIN 
                MedicCabinete mc ON m.IDMedic = mc.IDMedic
            INNER JOIN 
                CabinetTestare ct ON mc.IDCabinet = ct.IDCabinet
            WHERE 
                mc.Data_Finalizare_activitate IS NOT NULL
            ORDER BY 
                ZileActivitate DESC;
        `;
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Eroare la preluarea datelor:', error);
        res.status(500).json({ message: 'Eroare la server' });
    }
});

//Medicii cu cel mai mare număr de roluri diferite
app.get('/medici-multiple-roluri', async (req, res) => {
    try {
        const query = `
            SELECT 
                m.Nume AS NumeMedic,
                m.Prenume AS PrenumeMedic,
                (
                    SELECT COUNT(DISTINCT mc.Rol_medic)
                    FROM MedicCabinete mc
                    WHERE mc.IDMedic = m.IDMedic
                ) AS NumarRoluri
            FROM 
                Medic m
            WHERE 
                (
                    SELECT COUNT(DISTINCT mc.Rol_medic)
                    FROM MedicCabinete mc
                    WHERE mc.IDMedic = m.IDMedic
                ) > 1
            ORDER BY 
                NumarRoluri DESC;
        `;
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Eroare la preluarea datelor:', error.message);
        res.status(500).json({ message: 'Eroare la server' });
    }
});

//medicii care inca participa la testari clinice in desfasurare
app.get('/medici-activi', async (req, res) => {
    try {
        const query = `
            SELECT 
                m.Nume AS NumeMedic,
                m.Prenume AS PrenumeMedic,
                c.NumeCabinet AS NumeCabinet,
                mc.Data_Incepere_activitate AS DataIncepere
            FROM 
                Medic m
            INNER JOIN 
                MedicCabinete mc ON m.IDMedic = mc.IDMedic
            INNER JOIN 
                CabinetTestare c ON mc.IDCabinet = c.IDCabinet
            WHERE 
                mc.Data_Finalizare_activitate IS NULL
            ORDER BY 
                m.Nume, c.NumeCabinet;
        `;

        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Eroare la preluarea medicilor activi:', error);
        res.status(500).json({ message: 'Eroare la server' });
    }
});


//istoric medical
// GET - Preluare toate intrările din tabelul IstoricMedical cu numele pacienților
app.get("/istoric-medical", async (req, res) => {
    const query = `
        SELECT 
            im.IDIstoric_Medical,
            im.IDPacient,
            CONCAT(p.Nume, ' ', p.Prenume) AS NumePacient,
            im.GrupaSanguina,
            im.Alergii,
            im.Boli
        FROM 
            IstoricMedical im
        LEFT JOIN 
            Pacienti p ON im.IDPacient = p.IDPacient
    `;
    try {
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea datelor din IstoricMedical:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});


// POST - Adăugare o nouă intrare în tabelul IstoricMedical
app.post("/istoric-medical", async (req, res) => {
    const { IDPacient, GrupaSanguina, Alergii, Boli } = req.body;

    const query = `
        INSERT INTO IstoricMedical (IDPacient, GrupaSanguina, Alergii, Boli)
        OUTPUT INSERTED.*
        VALUES (@IDPacient, @GrupaSanguina, @Alergii, @Boli)
    `;

    try {
        const result = await pool.request()
            .input("IDPacient", sql.Int, IDPacient)
            .input("GrupaSanguina", sql.Char, GrupaSanguina)
            .input("Alergii", sql.NVarChar, Alergii || null)
            .input("Boli", sql.NVarChar, Boli || null)
            .query(query);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Eroare la adăugarea datelor în IstoricMedical:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

// PUT - Actualizare o intrare existentă din tabelul IstoricMedical
app.put("/istoric-medical/:id", async (req, res) => {
    const { id } = req.params;
    const { IDPacient, GrupaSanguina, Alergii, Boli } = req.body;

    const query = `
        UPDATE IstoricMedical
        SET 
            IDPacient = @IDPacient,
            GrupaSanguina = @GrupaSanguina,
            Alergii = @Alergii,
            Boli = @Boli
        OUTPUT INSERTED.*
        WHERE IDIstoric_Medical = @IDIstoric_Medical
    `;

    try {
        const result = await pool.request()
            .input("IDIstoric_Medical", sql.Int, id)
            .input("IDPacient", sql.Int, IDPacient)
            .input("GrupaSanguina", sql.Char, GrupaSanguina)
            .input("Alergii", sql.NVarChar, Alergii || null)
            .input("Boli", sql.NVarChar, Boli || null)
            .query(query);

        if (result.recordset.length === 0) {
            res.status(404).json({ message: "Intrarea nu a fost găsită." });
        } else {
            res.status(200).json(result.recordset[0]);
        }
    } catch (error) {
        console.error("Eroare la actualizarea datelor în IstoricMedical:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

// DELETE - Ștergere o intrare din tabelul IstoricMedical
app.delete("/istoric-medical/:id", async (req, res) => {
    const { id } = req.params;

    const query = `
        DELETE FROM IstoricMedical
        WHERE IDIstoric_Medical = @IDIstoric_Medical
    `;

    try {
        const result = await pool.request()
            .input("IDIstoric_Medical", sql.Int, id)
            .query(query);

        if (result.rowsAffected[0] === 0) {
            res.status(404).json({ message: "Intrarea nu a fost găsită." });
        } else {
            res.status(200).json({ message: "Intrarea a fost ștearsă cu succes." });
        }
    } catch (error) {
        console.error("Eroare la ștergerea datelor din IstoricMedical:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

//cautare dupa grupa sanguina cu parametru variabill
app.get("/istoric-medical/filter", async (req, res) => {
    const { GrupaSanguina } = req.query; // Parametru variabil din query string

    if (!GrupaSanguina) {
        return res.status(400).json({ message: "Parametrul 'GrupaSanguina' este obligatoriu." });
    }

    const query = `
        SELECT 
            im.IDIstoric_Medical,
            CONCAT(p.Nume, ' ', p.Prenume) AS NumePacient,
            im.GrupaSanguina,
            im.Alergii,
            im.Boli
        FROM 
            IstoricMedical im
        INNER JOIN 
            Pacienti p ON im.IDPacient = p.IDPacient
        WHERE 
            im.GrupaSanguina = @GrupaSanguina
    `;

    try {
        const result = await pool.request()
            .input("GrupaSanguina", sql.Char, GrupaSanguina)
            .query(query);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la interogarea cu filtrare:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});


//testare clinica 
// Endpoint GET pentru TestareClinica cu join-uri pentru Medicamente și Medic
app.get("/testare-clinica", async (req, res) => {
    try {
        const query = `
            SELECT 
                tc.IDTestare,
                tc.Nume,
                tc.Data_Inceput,
                tc.Data_Sfarsit,
                tc.FazaTest,
                m.Denumire AS Medicament,
                CONCAT(md.Nume, ' ', md.Prenume) AS Medic
            FROM 
                TestareClinica tc
            LEFT JOIN 
                Medicamente m ON tc.IDMedicament = m.IDMedicament
            LEFT JOIN 
                Medic md ON tc.IDMedic = md.IDMedic
        `;
        const result = await pool.request().query(query);
        console.log("Testări clinice returnate:", result.recordset); // Log pentru debugging
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea testărilor clinice:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});



app.post("/testare-clinica", async (req, res) => {
    const { Nume, IDMedicament, Data_Inceput, Data_Sfarsit, FazaTest, IDMedic } = req.body;
    const query = `
        INSERT INTO TestareClinica (Nume, IDMedicament, Data_Inceput, Data_Sfarsit, FazaTest, IDMedic)
        OUTPUT INSERTED.*
        VALUES (@Nume, @IDMedicament, @Data_Inceput, @Data_Sfarsit, @FazaTest, @IDMedic);
    `;
    try {
        const result = await pool.request()
            .input("Nume", sql.NVarChar, Nume)
            .input("IDMedicament", sql.Int, IDMedicament)
            .input("Data_Inceput", sql.Date, Data_Inceput)
            .input("Data_Sfarsit", sql.Date, Data_Sfarsit || null)
            .input("FazaTest", sql.NVarChar, FazaTest)
            .input("IDMedic", sql.Int, IDMedic)
            .query(query);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Eroare la adăugarea testării clinice:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});


app.put("/testare-clinica/:id", async (req, res) => {
    const { id } = req.params;
    const { Nume, IDMedicament, Data_Inceput, Data_Sfarsit, FazaTest, IDMedic } = req.body;

    const query = `
        UPDATE TestareClinica
        SET 
            Nume = @Nume,
            IDMedicament = @IDMedicament,
            Data_Inceput = @Data_Inceput,
            Data_Sfarsit = @Data_Sfarsit,
            FazaTest = @FazaTest,
            IDMedic = @IDMedic
        OUTPUT INSERTED.*
        WHERE IDTestare = @IDTestare;
    `;

    try {
        const result = await pool.request()
            .input("IDTestare", sql.Int, id)
            .input("Nume", sql.NVarChar, Nume)
            .input("IDMedicament", sql.Int, IDMedicament)
            .input("Data_Inceput", sql.Date, Data_Inceput)
            .input("Data_Sfarsit", sql.Date, Data_Sfarsit || null)
            .input("FazaTest", sql.NVarChar, FazaTest)
            .input("IDMedic", sql.Int, IDMedic)
            .query(query);

        res.status(200).json(result.recordset[0]);
    } catch (error) {
        console.error("Eroare la actualizare:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

app.delete("/testare-clinica/:id", async (req, res) => {
    const { id } = req.params;

    const query = `
        DELETE FROM TestareClinica WHERE IDTestare = @IDTestare;
    `;
    try {
        const result = await pool.request().input("IDTestare", sql.Int, id).query(query);

        if (result.rowsAffected[0] === 0) {
            res.status(404).json({ message: "Testarea nu a fost găsită." });
        } else {
            res.status(200).json({ message: "Testarea a fost ștearsă cu succes." });
        }
    } catch (error) {
        console.error("Eroare la ștergere:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

//statistici testare clinica
app.get('/testari-clinice-pacienti', async (req, res) => {
    try {
        const query = `
            SELECT 
                tc.Nume AS NumeTestare,
                tc.FazaTest,
                m.Denumire AS Medicament,
                COUNT(p.IDPacient) AS NumarPacienti
            FROM 
                TestareClinica tc
            LEFT JOIN 
                Medicamente m ON tc.IDMedicament = m.IDMedicament
            LEFT JOIN 
                RezultatTestare rt ON tc.IDTestare = rt.IDTestare
            LEFT JOIN 
                Pacienti p ON rt.IDPacient = p.IDPacient
            GROUP BY 
                tc.Nume, tc.FazaTest, m.Denumire
            ORDER BY 
                NumarPacienti DESC;
        `;
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Eroare la preluarea statisticilor testărilor clinice:', error);
        res.status(500).json({ message: 'Eroare la server' });
    }
});

//returneaza doar testările clinice care au început înainte de o anumită dată, 
app.get("/testari-clinice-filtrate", async (req, res) => {
    const { data } = req.query;

    if (!data) {
        return res.status(400).json({ message: "Parametrul 'data' este obligatoriu." });
    }

    const query = `
        SELECT 
            tc.IDTestare,
            tc.Nume AS NumeTestare,
            tc.FazaTest,
            tc.Data_Inceput,
            tc.Data_Sfarsit,
            m.Denumire AS Medicament
        FROM 
            TestareClinica tc
        LEFT JOIN 
            Medicamente m ON tc.IDMedicament = m.IDMedicament
        WHERE 
            tc.Data_Inceput < @Data
        ORDER BY 
            tc.Data_Inceput DESC;
    `;

    try {
        const result = await pool.request()
            .input("Data", sql.Date, data)
            .query(query);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la interogarea testărilor clinice filtrate:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

//Rezultat Testare
// GET - Preluare date legate (ID + nume pacient/testare)
app.get("/rezultate-testare", async (req, res) => {
    const query = `
        SELECT 
            r.IDRezultat,
            CONCAT(p.Nume, ' ', p.Prenume) AS NumePacient,
            tc.Nume AS NumeTestare,
            r.Observatii,
            r.ReactiiAdverse
        FROM RezultatTestare r
        JOIN Pacienti p ON r.IDPacient = p.IDPacient
        JOIN TestareClinica tc ON r.IDTestare = tc.IDTestare
    `;
    try {
        const result = await pool.request().query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea datelor din RezultatTestare:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

// POST - Adăugare rezultat nou
app.post("/rezultate-testare", async (req, res) => {
    const { IDPacient, IDTestare, Observatii, ReactiiAdverse } = req.body;

    const query = `
        INSERT INTO RezultatTestare (IDPacient, IDTestare, Observatii, ReactiiAdverse)
        OUTPUT INSERTED.*
        VALUES (@IDPacient, @IDTestare, @Observatii, @ReactiiAdverse)
    `;
    try {
        const result = await pool.request()
            .input("IDPacient", sql.Int, IDPacient)
            .input("IDTestare", sql.Int, IDTestare)
            .input("Observatii", sql.NVarChar, Observatii || null)
            .input("ReactiiAdverse", sql.NVarChar, ReactiiAdverse || null)
            .query(query);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Eroare la adăugarea datelor în RezultatTestare:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

// PUT - Editare rezultat existent
app.put("/rezultate-testare/:id", async (req, res) => {
    const { id } = req.params;
    const { IDPacient, IDTestare, Observatii, ReactiiAdverse } = req.body;

    const query = `
        UPDATE RezultatTestare
        SET 
            IDPacient = @IDPacient,
            IDTestare = @IDTestare,
            Observatii = @Observatii,
            ReactiiAdverse = @ReactiiAdverse
        OUTPUT INSERTED.*
        WHERE IDRezultat = @IDRezultat
    `;
    try {
        const result = await pool.request()
            .input("IDRezultat", sql.Int, id)
            .input("IDPacient", sql.Int, IDPacient)
            .input("IDTestare", sql.Int, IDTestare)
            .input("Observatii", sql.NVarChar, Observatii || null)
            .input("ReactiiAdverse", sql.NVarChar, ReactiiAdverse || null)
            .query(query);

        if (result.recordset.length === 0) {
            res.status(404).json({ message: "Rezultatul nu a fost găsit." });
        } else {
            res.status(200).json(result.recordset[0]);
        }
    } catch (error) {
        console.error("Eroare la actualizarea datelor în RezultatTestare:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

// DELETE - Ștergere rezultat
app.delete("/rezultate-testare/:id", async (req, res) => {
    const { id } = req.params;

    const query = `
        DELETE FROM RezultatTestare
        WHERE IDRezultat = @IDRezultat
    `;
    try {
        const result = await pool.request()
            .input("IDRezultat", sql.Int, id)
            .query(query);

        if (result.rowsAffected[0] === 0) {
            res.status(404).json({ message: "Rezultatul nu a fost găsit." });
        } else {
            res.status(200).json({ message: "Rezultatul a fost șters cu succes." });
        }
    } catch (error) {
        console.error("Eroare la ștergerea datelor din RezultatTestare:", error);
        res.status(500).json({ message: "Eroare la server" });
    }
});

// GET - Filtrare rezultate testare după ReactiiAdverse
app.get("/rezultate-testare/filter-reactii-adverse", async (req, res) => {
    const { search } = req.query; // Parametrul variabil primit din frontend

    if (!search || search.trim() === "") {
        return res.status(400).json({ message: "Textul de căutare este obligatoriu." });
    }

    const query = `
        SELECT 
            r.IDRezultat,
            (SELECT CONCAT(p.Nume, ' ', p.Prenume) FROM Pacienti p WHERE p.IDPacient = r.IDPacient) AS NumePacient,
            (SELECT tc.Nume FROM TestareClinica tc WHERE tc.IDTestare = r.IDTestare) AS NumeTestare,
            r.Observatii,
            r.ReactiiAdverse
        FROM 
            RezultatTestare r
        WHERE 
            r.ReactiiAdverse LIKE '%' + @search + '%'
    `;

    try {
        const result = await pool.request()
            .input("search", sql.NVarChar, search)
            .query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Nu există rezultate care conțin reacțiile adverse specificate." });
        }

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la filtrarea rezultatelor după reacții adverse:", error);
        res.status(500).json({ message: "Eroare la server." });
    }
});

//statistici rezultate testare
app.get("/rezultate-testare/statistici-testare", async (req, res) => {
    const query = `
        SELECT 
            tc.Nume AS NumeTestare,
            tc.FazaTest,
            m.Denumire AS Medicament,
            CONCAT(md.Nume, ' ', md.Prenume) AS NumeMedic,
            COUNT(rt.IDRezultat) AS NumarRezultate,
            SUM(CASE WHEN rt.ReactiiAdverse IS NOT NULL THEN 1 ELSE 0 END) AS NumarReactiiAdverse
        FROM 
            TestareClinica tc
        LEFT JOIN 
            Medicamente m ON tc.IDMedicament = m.IDMedicament
        LEFT JOIN 
            Medic md ON tc.IDMedic = md.IDMedic
        LEFT JOIN 
            RezultatTestare rt ON tc.IDTestare = rt.IDTestare
        LEFT JOIN 
            Pacienti p ON rt.IDPacient = p.IDPacient
        GROUP BY 
            tc.Nume, tc.FazaTest, m.Denumire, md.Nume, md.Prenume
        
    `;
    try {
        console.log("Executing query for statistici...");
        const result = await pool.request().query(query);
        console.log("Query executed successfully:", result.recordset);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Eroare la preluarea sumarului rezultatelor:", error.message);
        res.status(500).json({ message: "Eroare la server", error: error.message });
    }
});






    



// Rulează serverul pe portul 8081
app.listen(8081, () => {
    console.log("Server is running on port 8081");
});







